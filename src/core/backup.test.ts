import { describe, expect, it } from 'vitest';
import { BackupError, backupFileName, createBackup, parseBackup } from './backup';
import type { Note } from './types';

const NOTE: Note = {
    id: 'abc',
    scope: 'page',
    scopeKey: 'example.com/a',
    url: 'https://example.com/a',
    title: 'A',
    content: 'hello',
    color: 'yellow',
    x: 10,
    y: 20,
    width: 240,
    height: 200,
    minimized: false,
    createdAt: 1,
    updatedAt: 2,
};

describe('createBackup / parseBackup', () => {
    it('round-trips notes through JSON', () => {
        const text = JSON.stringify(createBackup([NOTE], new Date('2026-10-27T10:00:00Z')));

        expect(parseBackup(text)).toEqual({ notes: [NOTE], invalid: 0 });
    });

    it('leaves out and counts broken notes', () => {
        const backup = createBackup([NOTE]);
        const text = JSON.stringify({
            ...backup,
            notes: [NOTE, { ...NOTE, color: 'orange' }, { ...NOTE, x: 'left' }, null],
        });

        expect(parseBackup(text)).toEqual({ notes: [NOTE], invalid: 3 });
    });

    it.each([
        ['not JSON', 'hello'],
        ['another app', JSON.stringify({ app: 'other', version: 1, notes: [] })],
        ['missing notes', JSON.stringify({ app: 'sticky-notes', version: 1 })],
        ['a bare array', JSON.stringify([NOTE])],
        ['a newer version', JSON.stringify({ app: 'sticky-notes', version: 99, notes: [] })],
    ])('rejects %s', (_label, text) => {
        expect(() => parseBackup(text)).toThrow(BackupError);
    });
});

describe('backupFileName', () => {
    it('includes the local date', () => {
        expect(backupFileName(new Date(2026, 0, 5))).toBe('sticky-notes-2026-01-05.json');
    });
});
