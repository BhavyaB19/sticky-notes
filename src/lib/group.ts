import type { Note } from './types';
import { getUrlKeys } from './url';

export interface SiteGroup {
    site: string;
    notes: Note[];
}

export function siteOf(note: Note): string {
    return getUrlKeys(note.url)?.siteKey ?? note.scopeKey;
}

// Case-insensitive match on the note text, page title or address
export function filterNotes(notes: Note[], query: string): Note[] {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) =>
        [note.content, note.title, note.url].some((field) => field.toLowerCase().includes(q)),
    );
}

// Newest first, by creation time: sorting by last edit would make notes and whole sites
// jump around the dashboard while you type in them
export function groupBySite(notes: Note[]): SiteGroup[] {
    const groups = new Map<string, Note[]>();
    for (const note of notes) {
        const site = siteOf(note);
        groups.set(site, [...(groups.get(site) ?? []), note]);
    }

    const newest = (list: Note[]) => Math.max(...list.map((n) => n.createdAt));
    return [...groups]
        .map(([site, list]) => ({ site, notes: list.sort((a, b) => b.createdAt - a.createdAt) }))
        .sort((a, b) => newest(b.notes) - newest(a.notes));
}
