import { browser } from 'wxt/browser';
import { createId } from './id';
import {
    DEFAULT_COLOR,
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    NEW_TAB_KEY,
    type NewNote,
    type Note,
    type NoteChanges,
    type Scope,
} from './types';
import { getScopeKey, getUrlKeys } from './url';

// Notes are grouped into one storage entry ("bucket") per page or site:
//   "notes:page:github.com/user/repo" -> Note[]
//   "notes:site:github.com"           -> Note[]
//   "notes:newtab:newtab"             -> Note[] (the extension's new tab page)
// The page:/site: part keeps a homepage's page notes apart from its site-wide notes,
// since both would otherwise have the key "github.com".
//
// Updates are read-modify-write, so two tabs of the same page saving within the same few
// milliseconds could overwrite each other. Unlikely with one person typing; accepted for now.

const PREFIX = 'notes:';

type StorageChangeListener = Parameters<typeof browser.storage.onChanged.addListener>[0];

function bucketKey(scope: Scope, scopeKey: string): string {
    return `${PREFIX}${scope}:${scopeKey}`;
}

async function readBucket(key: string): Promise<Note[]> {
    const result = (await browser.storage.local.get(key)) as Record<string, Note[] | undefined>;
    return result[key] ?? [];
}

// Empty buckets are removed rather than stored as []. Non-empty buckets are written first,
// so if the remove fails a moved note ends up duplicated rather than lost.
async function writeBuckets(buckets: Record<string, Note[]>): Promise<void> {
    const entries = Object.entries(buckets);
    const filled = entries.filter(([, notes]) => notes.length > 0);
    const emptyKeys = entries.filter(([, notes]) => notes.length === 0).map(([key]) => key);

    if (filled.length > 0) await browser.storage.local.set(Object.fromEntries(filled));
    if (emptyKeys.length > 0) await browser.storage.local.remove(emptyKeys);
}

export async function getNotesForUrl(url: string): Promise<Note[]> {
    const keys = getUrlKeys(url);
    if (!keys) return [];

    const [pageNotes, siteNotes] = await Promise.all([
        readBucket(bucketKey('page', keys.pageKey)),
        readBucket(bucketKey('site', keys.siteKey)),
    ]);
    return [...pageNotes, ...siteNotes];
}

export async function getNewTabNotes(): Promise<Note[]> {
    return readBucket(bucketKey('newtab', NEW_TAB_KEY));
}

// Every bucket, keyed by storage key
async function readAllBuckets(): Promise<Record<string, Note[]>> {
    const everything = (await browser.storage.local.get(null)) as Record<string, unknown>;
    return Object.fromEntries(
        Object.entries(everything).filter(([key]) => key.startsWith(PREFIX)),
    ) as Record<string, Note[]>;
}

export async function getAllNotes(): Promise<Note[]> {
    const buckets = await readAllBuckets();
    return Object.values(buckets)
        .flat()
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteAllNotes(): Promise<void> {
    const keys = Object.keys(await readAllBuckets());
    if (keys.length > 0) await browser.storage.local.remove(keys);
}

export interface ImportResult {
    added: number;
    updated: number; // replaced an older copy of the same note
    skipped: number; // already up to date, or for a page notes can't live on
}

// Merges notes from a backup. A note that already exists (same id) is only replaced
// when the backup's copy is newer, so importing the same file twice changes nothing.
export async function importNotes(notes: Note[]): Promise<ImportResult> {
    const buckets = await readAllBuckets();
    const bucketOf = new Map<string, string>(); // note id -> bucket key
    for (const [key, list] of Object.entries(buckets)) {
        for (const note of list) bucketOf.set(note.id, key);
    }

    const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
    const changedKeys = new Set<string>();

    for (const incoming of notes) {
        // Recomputed rather than trusted, in case the file was edited by hand
        const scopeKey = getScopeKey(incoming.url, incoming.scope);
        if (scopeKey === null) {
            result.skipped++;
            continue;
        }
        const note: Note = { ...incoming, scopeKey };

        const existingKey = bucketOf.get(note.id);
        if (existingKey !== undefined) {
            const list = buckets[existingKey] ?? [];
            const existing = list.find((n) => n.id === note.id);
            if (existing && existing.updatedAt >= note.updatedAt) {
                result.skipped++;
                continue;
            }
            buckets[existingKey] = list.filter((n) => n.id !== note.id);
            changedKeys.add(existingKey);
            result.updated++;
        } else {
            result.added++;
        }

        const key = bucketKey(note.scope, scopeKey);
        buckets[key] = [...(buckets[key] ?? []), note];
        bucketOf.set(note.id, key);
        changedKeys.add(key);
    }

    if (changedKeys.size > 0) {
        await writeBuckets(Object.fromEntries([...changedKeys].map((k) => [k, buckets[k] ?? []])));
    }
    return result;
}

export async function createNote(input: NewNote): Promise<Note> {
    const scopeKey = getScopeKey(input.url, input.scope);
    if (scopeKey === null) throw new Error(`Notes are not supported on ${input.url}`);

    const now = Date.now();
    const note: Note = {
        id: createId(),
        scope: input.scope,
        scopeKey,
        url: input.url,
        title: input.title,
        content: input.content ?? '',
        color: input.color ?? DEFAULT_COLOR,
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: input.width ?? DEFAULT_WIDTH,
        height: input.height ?? DEFAULT_HEIGHT,
        minimized: false,
        createdAt: now,
        updatedAt: now,
    };

    const key = bucketKey(note.scope, scopeKey);
    const notes = await readBucket(key);
    await writeBuckets({ [key]: [...notes, note] });
    return note;
}

export async function updateNote(note: Note, changes: NoteChanges): Promise<Note> {
    const key = bucketKey(note.scope, note.scopeKey);
    const notes = await readBucket(key);
    const stored = notes.find((n) => n.id === note.id);
    if (!stored) throw new Error(`Note ${note.id} not found`);

    // Merge onto the stored copy, which may be newer than the one the caller holds
    const updated: Note = { ...stored, ...changes, updatedAt: Date.now() };
    await writeBuckets({ [key]: notes.map((n) => (n.id === note.id ? updated : n)) });
    return updated;
}

export async function deleteNote(note: Note): Promise<void> {
    const key = bucketKey(note.scope, note.scopeKey);
    const notes = await readBucket(key);
    if (!notes.some((n) => n.id === note.id)) return;

    await writeBuckets({ [key]: notes.filter((n) => n.id !== note.id) });
}

// Puts a deleted note back exactly as it was ("Undo")
export async function restoreNote(note: Note): Promise<void> {
    const key = bucketKey(note.scope, note.scopeKey);
    const notes = await readBucket(key);
    if (notes.some((n) => n.id === note.id)) return;

    await writeBuckets({ [key]: [...notes, note] });
}

// `page` is where the user is now. Narrowing a site note to "this page" means the page they're
// looking at, not the one it was first created on. Defaults to the note's own page.
export async function changeScope(
    note: Note,
    scope: Scope,
    page: { url: string; title: string } = note,
): Promise<Note> {
    if (scope === note.scope) return note;
    // New tab notes have no website to move to or from
    if (scope === 'newtab' || note.scope === 'newtab') {
        throw new Error('New tab notes cannot change scope');
    }

    // A site key is the same from any page of the site; only a page key depends on the page
    const target = scope === 'page' ? page : note;
    const scopeKey = getScopeKey(target.url, scope);
    if (scopeKey === null) throw new Error(`Notes are not supported on ${target.url}`);

    const oldKey = bucketKey(note.scope, note.scopeKey);
    const newKey = bucketKey(scope, scopeKey);
    const [oldNotes, newNotes] = await Promise.all([readBucket(oldKey), readBucket(newKey)]);
    const stored = oldNotes.find((n) => n.id === note.id);
    if (!stored) throw new Error(`Note ${note.id} not found`);

    const moved: Note = {
        ...stored,
        scope,
        scopeKey,
        url: target.url,
        title: target.title,
        updatedAt: Date.now(),
    };
    await writeBuckets({
        [oldKey]: oldNotes.filter((n) => n.id !== note.id),
        [newKey]: [...newNotes, moved],
    });
    return moved;
}

// Fires when any note changes, in this tab or another one. Returns an unsubscribe function.
export function onNotesChanged(callback: () => void): () => void {
    const listener: StorageChangeListener = (changes, areaName) => {
        if (areaName !== 'local') return;
        if (Object.keys(changes).some((key) => key.startsWith(PREFIX))) callback();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
}
