import { browser } from 'wxt/browser';
import { getUrlKeys } from './url';

// Sites where the user chose to hide notes, by site key (e.g. "github.com").
// Notes there are kept; they just aren't drawn on the page.
const HIDDEN_SITES_KEY = 'settings:hiddenSites';

type StorageChangeListener = Parameters<typeof browser.storage.onChanged.addListener>[0];

export async function getHiddenSites(): Promise<string[]> {
    const result = (await browser.storage.local.get(HIDDEN_SITES_KEY)) as Record<
        string,
        string[] | undefined
    >;
    return result[HIDDEN_SITES_KEY] ?? [];
}

// Accepts any page URL of the site
export async function isSiteHidden(url: string): Promise<boolean> {
    const site = getUrlKeys(url)?.siteKey;
    return site !== undefined && (await getHiddenSites()).includes(site);
}

export async function setSiteHidden(url: string, hidden: boolean): Promise<void> {
    const site = getUrlKeys(url)?.siteKey;
    if (site !== undefined) await setSiteKeyHidden(site, hidden);
}

// Same, for callers that already have the site key (the dashboard's site groups)
export async function setSiteKeyHidden(site: string, hidden: boolean): Promise<void> {
    const sites = await getHiddenSites();
    if (sites.includes(site) === hidden) return;
    const next = hidden ? [...sites, site] : sites.filter((s) => s !== site);
    await browser.storage.local.set({ [HIDDEN_SITES_KEY]: next });
}

export function onHiddenSitesChanged(callback: () => void): () => void {
    const listener: StorageChangeListener = (changes, areaName) => {
        if (areaName === 'local' && HIDDEN_SITES_KEY in changes) callback();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
}
