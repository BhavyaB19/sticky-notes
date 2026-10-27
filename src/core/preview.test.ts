import { describe, expect, it } from 'vitest';
import { notePreview } from './preview';

describe('notePreview', () => {
    it('returns the first line', () => {
        expect(notePreview('Buy milk\nand eggs')).toBe('Buy milk');
    });

    it('skips leading blank lines and trims', () => {
        expect(notePreview('\n   \n  Call Sam  \nlater')).toBe('Call Sam');
    });

    it('shortens long lines to 50 characters with an ellipsis', () => {
        const preview = notePreview('a'.repeat(80));
        expect(preview).toHaveLength(50);
        expect(preview.endsWith('…')).toBe(true);
    });

    it('keeps a line of exactly 50 characters', () => {
        expect(notePreview('b'.repeat(50))).toBe('b'.repeat(50));
    });

    it.each(['', '   ', '\n\n  \n'])('labels empty notes (%j)', (content) => {
        expect(notePreview(content)).toBe('(empty note)');
    });
});
