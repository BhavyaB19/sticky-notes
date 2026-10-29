import { describe, expect, it } from 'vitest';
import { filterNotes, groupBySite } from './group';
import type { Note } from './types';

function note(id: string, url: string, createdAt: number, extra: Partial<Note> = {}): Note {
    return {
        id,
        scope: 'page',
        scopeKey: '',
        url,
        title: '',
        content: '',
        color: 'yellow',
        x: 0,
        y: 0,
        width: 240,
        height: 200,
        minimized: false,
        createdAt,
        updatedAt: createdAt,
        ...extra,
    };
}

describe('groupBySite', () => {
    it('groups by domain, newest site and newest note first', () => {
        const a1 = note('a1', 'https://www.a.com/x', 1);
        const b1 = note('b1', 'https://b.com/', 2);
        const a2 = note('a2', 'https://a.com/y', 3);
        const site = note('s', 'https://b.com/z', 0, { scope: 'site' });

        expect(groupBySite([a1, b1, a2, site])).toEqual([
            { site: 'a.com', notes: [a2, a1] },
            { site: 'b.com', notes: [b1, site] },
        ]);
    });

    it('puts new tab notes in their own "New tab" group', () => {
        const tab = note('t', '', 5, { scope: 'newtab', scopeKey: 'newtab' });
        const web = note('w', 'https://a.com/', 1);

        expect(groupBySite([web, tab])).toEqual([
            { site: 'New tab', notes: [tab] },
            { site: 'a.com', notes: [web] },
        ]);
    });

    it('does not reorder when a note is edited', () => {
        const older = note('old', 'https://a.com/', 1, { updatedAt: 999 });
        const newer = note('new', 'https://a.com/', 2);

        expect(groupBySite([older, newer])[0]?.notes).toEqual([newer, older]);
    });

    it('returns nothing for no notes', () => {
        expect(groupBySite([])).toEqual([]);
    });
});

describe('filterNotes', () => {
    const notes = [
        note('1', 'https://github.com/repo', 1, { content: 'Fix the Login bug' }),
        note('2', 'https://news.com/', 2, { title: 'Morning headlines' }),
        note('3', 'https://shop.com/cart', 3),
    ];

    it.each([
        ['login', ['1']],
        ['HEADLINES', ['2']],
        ['shop.com', ['3']],
        ['  ', ['1', '2', '3']],
        ['nothing matches', []],
    ])('%j → %j', (query, ids) => {
        expect(filterNotes(notes, query).map((n) => n.id)).toEqual(ids);
    });
});
