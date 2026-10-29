import { NEW_TAB_KEY, type Scope } from './types';

export interface UrlKeys {
    pageKey: string;
    siteKey: string;
}

const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'msclkid', 'mc_eid', 'ref', 'ref_src']);

function isTrackingParam(name: string): boolean {
    return name.startsWith('utm_') || TRACKING_PARAMS.has(name);
}

// Turns a URL into stable keys, so the same page always maps to the same notes.
// Returns null for URLs notes can't live on (chrome://, about:, invalid input, ...).
export function getUrlKeys(rawUrl: string): UrlKeys | null {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    // URL already lowercases the host and drops default ports
    const host = url.host.replace(/^www\./, '');
    // Path stays case-sensitive: /Docs and /docs can be different pages
    const path = url.pathname.replace(/\/+$/, '');
    const params = [...url.searchParams]
        .filter(([name]) => !isTrackingParam(name))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const query = new URLSearchParams(params).toString();

    return { pageKey: host + path + (query ? `?${query}` : ''), siteKey: host };
}

export function getScopeKey(rawUrl: string, scope: Scope): string | null {
    if (scope === 'newtab') return NEW_TAB_KEY; // not tied to any address
    const keys = getUrlKeys(rawUrl);
    if (!keys) return null;
    return scope === 'page' ? keys.pageKey : keys.siteKey;
}
