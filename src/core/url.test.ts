import { describe, expect, it } from 'vitest';
import { getScopeKey, getUrlKeys } from './url';

describe('getUrlKeys', () => {
    it.each([
        ['https://www.x.com/a/?utm_source=z#top', 'x.com/a', 'x.com'],
        ['https://X.com/A', 'x.com/A', 'x.com'],
        ['https://x.com/', 'x.com', 'x.com'],
        ['https://youtube.com/watch?v=abc&utm_medium=q', 'youtube.com/watch?v=abc', 'youtube.com'],
        ['https://x.com/s?b=2&a=1', 'x.com/s?a=1&b=2', 'x.com'],
        ['https://x.com/s?fbclid=1&gclid=2&ref=3&q=hi', 'x.com/s?q=hi', 'x.com'],
        ['http://localhost:3000/app', 'localhost:3000/app', 'localhost:3000'],
        ['https://x.com:443/a', 'x.com/a', 'x.com'],
    ])('%s', (input, pageKey, siteKey) => {
        expect(getUrlKeys(input)).toEqual({ pageKey, siteKey });
    });

    it.each([
        'chrome://extensions',
        'about:blank',
        'chrome-extension://abc/popup.html',
        'not a url',
    ])('returns null for %s', (input) => {
        expect(getUrlKeys(input)).toBeNull();
    });
});

describe('getScopeKey', () => {
    it('returns the page key or site key', () => {
        expect(getScopeKey('https://www.x.com/a/b', 'page')).toBe('x.com/a/b');
        expect(getScopeKey('https://www.x.com/a/b', 'site')).toBe('x.com');
    });

    it('returns null for unsupported URLs', () => {
        expect(getScopeKey('chrome://settings', 'site')).toBeNull();
    });
});
