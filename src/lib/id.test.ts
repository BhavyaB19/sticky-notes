import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from './id';

describe('createId', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns unique ids', () => {
        const ids = new Set(Array.from({ length: 100 }, createId));
        expect(ids.size).toBe(100);
    });

    it('falls back when randomUUID is unavailable (plain HTTP pages)', () => {
        vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
        expect(createId()).toMatch(/^[0-9a-f]{32}$/);
    });
});
