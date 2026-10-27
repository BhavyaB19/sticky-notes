import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
    changeScope,
    createNote,
    deleteAllNotes,
    deleteNote,
    getAllNotes,
    getNotesForUrl,
    importNotes,
    onNotesChanged,
    updateNote,
} from './storage';
import { DEFAULT_COLOR, DEFAULT_HEIGHT, DEFAULT_WIDTH, type NewNote } from './types';

const PAGE_URL = 'https://www.example.com/articles/1';

function pageNote(overrides: Partial<NewNote> = {}): NewNote {
    return { scope: 'page', url: PAGE_URL, title: 'Article 1', ...overrides };
}

async function storedKeys(): Promise<string[]> {
    return Object.keys(await browser.storage.local.get(null));
}

beforeEach(() => {
    fakeBrowser.reset();
    // Fake only Date so storage promises still resolve normally
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('createNote', () => {
    it('fills in id, scope key, defaults and timestamps', async () => {
        const note = await createNote(pageNote());

        expect(note).toEqual({
            id: expect.any(String),
            scope: 'page',
            scopeKey: 'example.com/articles/1',
            url: PAGE_URL,
            title: 'Article 1',
            content: '',
            color: DEFAULT_COLOR,
            x: 0,
            y: 0,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            minimized: false,
            createdAt: 1_000,
            updatedAt: 1_000,
        });
    });

    it('throws for unsupported URLs', async () => {
        await expect(createNote(pageNote({ url: 'chrome://settings' }))).rejects.toThrow();
    });
});

describe('getNotesForUrl', () => {
    it('finds a page note under the same page with a hash or tracking params', async () => {
        const note = await createNote(pageNote());

        expect(await getNotesForUrl(PAGE_URL)).toEqual([note]);
        expect(await getNotesForUrl('https://example.com/articles/1/#comments')).toEqual([note]);
        expect(await getNotesForUrl(`${PAGE_URL}?utm_source=newsletter`)).toEqual([note]);
    });

    it('does not show a page note on other pages of the site', async () => {
        await createNote(pageNote());

        expect(await getNotesForUrl('https://example.com/articles/2')).toEqual([]);
    });

    it('shows a site note on every page of the domain', async () => {
        const note = await createNote(pageNote({ scope: 'site' }));

        expect(await getNotesForUrl('https://example.com/')).toEqual([note]);
        expect(await getNotesForUrl('https://example.com/about?x=1')).toEqual([note]);
        expect(await getNotesForUrl('https://other.com/')).toEqual([]);
    });

    it('keeps homepage page notes apart from site notes', async () => {
        const homeNote = await createNote(pageNote({ url: 'https://example.com/' }));
        const siteNote = await createNote(pageNote({ url: 'https://example.com/', scope: 'site' }));

        expect(await getNotesForUrl('https://example.com')).toEqual([homeNote, siteNote]);
        expect(await getNotesForUrl('https://example.com/other')).toEqual([siteNote]);
    });

    it('returns [] for unsupported URLs', async () => {
        expect(await getNotesForUrl('chrome://settings')).toEqual([]);
    });
});

describe('updateNote', () => {
    it('changes only the given fields and bumps updatedAt', async () => {
        const note = await createNote(pageNote({ content: 'hello' }));
        vi.setSystemTime(2_000);

        const updated = await updateNote(note, { x: 50, color: 'pink' });

        expect(updated).toEqual({ ...note, x: 50, color: 'pink', updatedAt: 2_000 });
        expect(await getNotesForUrl(PAGE_URL)).toEqual([updated]);
    });

    it('leaves other notes in the same bucket alone', async () => {
        const first = await createNote(pageNote({ content: 'first' }));
        const second = await createNote(pageNote({ content: 'second' }));

        const updated = await updateNote(first, { content: 'changed' });

        expect(await getNotesForUrl(PAGE_URL)).toEqual([updated, second]);
    });

    it('throws when the note no longer exists', async () => {
        const note = await createNote(pageNote());
        await deleteNote(note);

        await expect(updateNote(note, { content: 'x' })).rejects.toThrow();
    });
});

describe('deleteNote', () => {
    it('removes the note and drops the empty bucket', async () => {
        const note = await createNote(pageNote());

        await deleteNote(note);

        expect(await getNotesForUrl(PAGE_URL)).toEqual([]);
        expect(await storedKeys()).toEqual([]);
    });

    it('keeps the bucket while other notes remain', async () => {
        const first = await createNote(pageNote());
        const second = await createNote(pageNote());

        await deleteNote(first);

        expect(await getNotesForUrl(PAGE_URL)).toEqual([second]);
    });
});

describe('changeScope', () => {
    it('moves a page note to the whole site', async () => {
        const note = await createNote(pageNote());
        vi.setSystemTime(2_000);

        const moved = await changeScope(note, 'site');

        expect(moved).toEqual({
            ...note,
            scope: 'site',
            scopeKey: 'example.com',
            updatedAt: 2_000,
        });
        expect(await getNotesForUrl('https://example.com/elsewhere')).toEqual([moved]);
        expect(await getNotesForUrl(PAGE_URL)).toEqual([moved]);
        expect(await storedKeys()).toEqual(['notes:site:example.com']);
    });

    it('moves a site note back to its original page', async () => {
        const note = await createNote(pageNote({ scope: 'site' }));

        const moved = await changeScope(note, 'page');

        expect(moved.scopeKey).toBe('example.com/articles/1');
        expect(await getNotesForUrl('https://example.com/elsewhere')).toEqual([]);
        expect(await getNotesForUrl(PAGE_URL)).toEqual([moved]);
    });

    it('moves a site note to the page it is being viewed on', async () => {
        const note = await createNote(pageNote({ scope: 'site' }));
        const other = { url: 'https://example.com/about', title: 'About' };

        const moved = await changeScope(note, 'page', other);

        expect(moved).toMatchObject({
            scope: 'page',
            scopeKey: 'example.com/about',
            url: other.url,
            title: 'About',
        });
        expect(await getNotesForUrl(other.url)).toEqual([moved]);
        expect(await getNotesForUrl(PAGE_URL)).toEqual([]);
    });

    it('keeps the original page when widening to the whole site', async () => {
        const note = await createNote(pageNote());

        const moved = await changeScope(note, 'site', { url: 'https://example.com/x', title: 'X' });

        expect(moved).toMatchObject({ scopeKey: 'example.com', url: PAGE_URL, title: 'Article 1' });
    });
});

describe('getAllNotes', () => {
    it('returns notes from every bucket, most recently updated first', async () => {
        const a = await createNote(pageNote());
        vi.setSystemTime(2_000);
        const b = await createNote(pageNote({ url: 'https://other.com/', scope: 'site' }));
        vi.setSystemTime(3_000);
        const c = await createNote(pageNote({ url: 'https://third.com/x' }));
        await browser.storage.local.set({ unrelated: 1 });

        expect(await getAllNotes()).toEqual([c, b, a]);
    });
});

describe('deleteAllNotes', () => {
    it('removes every note but leaves other keys alone', async () => {
        await createNote(pageNote());
        await createNote(pageNote({ url: 'https://other.com/', scope: 'site' }));
        await browser.storage.local.set({ unrelated: 1 });

        await deleteAllNotes();

        expect(await getAllNotes()).toEqual([]);
        expect(await storedKeys()).toEqual(['unrelated']);
    });
});

describe('importNotes', () => {
    it('restores notes into the right buckets after everything was deleted', async () => {
        const page = await createNote(pageNote());
        const site = await createNote(pageNote({ url: 'https://other.com/a', scope: 'site' }));
        const backup = await getAllNotes();
        await deleteAllNotes();

        const result = await importNotes(backup);

        expect(result).toEqual({ added: 2, updated: 0, skipped: 0 });
        expect(await getNotesForUrl(PAGE_URL)).toEqual([page]);
        expect(await getNotesForUrl('https://other.com/b')).toEqual([site]);
    });

    it('changes nothing when importing the same notes twice', async () => {
        await createNote(pageNote());
        const backup = await getAllNotes();

        expect(await importNotes(backup)).toEqual({ added: 0, updated: 0, skipped: 1 });
        expect(await getAllNotes()).toEqual(backup);
    });

    it('replaces a note only when the backup copy is newer', async () => {
        const note = await createNote(pageNote({ content: 'old' }));
        const newer = { ...note, content: 'from backup', updatedAt: note.updatedAt + 1 };
        const older = { ...note, content: 'stale', updatedAt: note.updatedAt - 1 };

        expect(await importNotes([older])).toEqual({ added: 0, updated: 0, skipped: 1 });
        expect(await importNotes([newer])).toEqual({ added: 0, updated: 1, skipped: 0 });
        expect(await getNotesForUrl(PAGE_URL)).toEqual([newer]);
    });

    it('moves a note whose scope changed in the backup', async () => {
        const note = await createNote(pageNote());
        const widened = { ...note, scope: 'site' as const, updatedAt: note.updatedAt + 1 };

        await importNotes([widened]);

        expect(await getNotesForUrl('https://example.com/elsewhere')).toEqual([
            { ...widened, scopeKey: 'example.com' },
        ]);
        expect(await storedKeys()).toEqual(['notes:site:example.com']);
    });

    it('skips notes for unsupported URLs', async () => {
        const note = await createNote(pageNote());
        const broken = { ...note, id: 'other', url: 'chrome://settings' };

        expect(await importNotes([broken])).toEqual({ added: 0, updated: 0, skipped: 1 });
    });
});

describe('onNotesChanged', () => {
    it('fires on create, update and delete', async () => {
        const callback = vi.fn();
        onNotesChanged(callback);

        const note = await createNote(pageNote());
        expect(callback).toHaveBeenCalledTimes(1);

        await updateNote(note, { content: 'x' });
        expect(callback).toHaveBeenCalledTimes(2);

        await deleteNote(note);
        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('ignores unrelated keys', async () => {
        const callback = vi.fn();
        onNotesChanged(callback);

        await browser.storage.local.set({ foo: 1 });

        expect(callback).not.toHaveBeenCalled();
    });

    it('stops firing after unsubscribe', async () => {
        const callback = vi.fn();
        const unsubscribe = onNotesChanged(callback);
        unsubscribe();

        await createNote(pageNote());

        expect(callback).not.toHaveBeenCalled();
    });
});
