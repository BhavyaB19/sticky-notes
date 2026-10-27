import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getHiddenSites, isSiteHidden, onHiddenSitesChanged, setSiteHidden } from './settings';
import { createNote, getAllNotes } from './storage';

beforeEach(() => {
    fakeBrowser.reset();
});

describe('hidden sites', () => {
    it('hides every page of a site, by site key', async () => {
        await setSiteHidden('https://www.github.com/acme/app', true);

        expect(await getHiddenSites()).toEqual(['github.com']);
        expect(await isSiteHidden('https://github.com/other/repo')).toBe(true);
        expect(await isSiteHidden('https://gitlab.com/')).toBe(false);
    });

    it('shows a site again', async () => {
        await setSiteHidden('https://github.com/', true);
        await setSiteHidden('https://github.com/x', false);

        expect(await isSiteHidden('https://github.com/')).toBe(false);
    });

    it('does not add a site twice', async () => {
        await setSiteHidden('https://github.com/a', true);
        await setSiteHidden('https://github.com/b', true);

        expect(await getHiddenSites()).toEqual(['github.com']);
    });

    it('ignores unsupported URLs', async () => {
        await setSiteHidden('chrome://settings', true);

        expect(await getHiddenSites()).toEqual([]);
        expect(await isSiteHidden('chrome://settings')).toBe(false);
    });

    it('is not mistaken for notes', async () => {
        await setSiteHidden('https://github.com/', true);
        await createNote({ scope: 'site', url: 'https://github.com/', title: 'GitHub' });

        expect(await getAllNotes()).toHaveLength(1);
    });

    it('notifies on change only', async () => {
        const callback = vi.fn();
        const unsubscribe = onHiddenSitesChanged(callback);

        await createNote({ scope: 'page', url: 'https://a.com/', title: 'A' });
        expect(callback).not.toHaveBeenCalled();

        await setSiteHidden('https://a.com/', true);
        expect(callback).toHaveBeenCalledTimes(1);

        unsubscribe();
        await setSiteHidden('https://a.com/', false);
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
