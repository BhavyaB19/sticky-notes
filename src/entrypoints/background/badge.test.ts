import { describe, expect, it } from 'vitest';
import { badgeText } from './badge';

describe('badgeText', () => {
    it.each([
        [0, ''],
        [1, '1'],
        [99, '99'],
        [100, '99+'],
        [250, '99+'],
    ])('%i notes → %j', (count, text) => {
        expect(badgeText(count)).toBe(text);
    });
});
