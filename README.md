# Sticky Notes

A browser extension for sticking notes on any webpage. Notes stay where you put them until you delete them, and they're stored only on your own device.

## Features

- **Add a note** with the toolbar button, the right-click menu ("Add sticky note here", which also picks up selected text), or **Alt+Shift+N**.
- **Edit, drag, resize, recolor and minimize** notes right on the page. Everything saves automatically.
- **This page or whole site**: 📄 shows a note on one page, 🌐 on every page of the site.
- **Works on single-page sites** like YouTube and GitHub, where the URL changes without a reload.
- **Undo** a delete from the toast at the bottom of the page.
- **Hide notes on a site** from the popup. They're kept and come back when you turn it off.
- **All notes dashboard**: search, edit and delete every note, and export or import a JSON backup.
- The toolbar badge shows how many notes the current page has.

Notes can't appear on `chrome://` pages, the Chrome Web Store, the new tab page or the built-in PDF viewer, because browsers don't allow extensions there.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev          # opens Chrome with the extension loaded and live reload
npm test             # unit tests (watch mode); `npx vitest run` for a single run
npm run lint         # ESLint
npm run compile      # TypeScript type-check
npm run format       # Prettier
npm run build        # production build in .output/chrome-mv3
npm run zip          # zip for the Chrome Web Store
```

During `npm run dev` the toolbar icon is greyed out, so you can tell the dev build apart from an installed one.

## Project structure

```
src/
├── entrypoints/   what WXT builds into the extension; kept thin
│   ├── background/   context menu, keyboard shortcut, toolbar badge
│   ├── content/      runs on every page and mounts the notes
│   ├── popup/        toolbar popup (React)
│   └── dashboard/    "All notes" page (React)
├── core/          the notes themselves: types, storage, URL rules, backups, settings
├── page-ui/       notes drawn on webpages (plain DOM inside a Shadow DOM)
├── shared/        cross-part plumbing: message types, debounce
└── assets/        icon.svg, from which every icon size is generated
```

Tests sit next to the file they cover (`*.test.ts`).

### How notes are stored

Notes live in `chrome.storage.local`, grouped into one entry per page or per site:

```
notes:page:github.com/acme/app   → [Note, …]
notes:site:github.com            → [Note, …]
```

A page's address is normalized first (no `www.`, `#hash` or tracking parameters, sorted query), so the same page always finds its notes. Opening a page reads just two entries: its page and its site.
