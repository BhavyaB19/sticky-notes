import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
    srcDir: 'src',
    modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
    // Every icon size is generated from this one file (greyed out during `npm run dev`)
    autoIcons: { baseIconPath: 'assets/icon.svg' },
    manifest: ({ browser }) => ({
        name: 'Sticky Notes',
        description: 'Stick notes on any webpage. They stay until you delete them.',
        // activeTab: lets the popup and the shortcut read the current tab's address in every
        // browser, without the broader "tabs" permission. Adds no install warning.
        // search: the new tab page's search box, using the user's default search engine
        permissions: ['storage', 'contextMenus', 'activeTab', 'search'],
        commands: {
            'add-note': {
                suggested_key: { default: 'Alt+Shift+N' },
                description: 'Add a sticky note to this page',
            },
        },
        ...(browser === 'firefox' && {
            browser_specific_settings: {
                gecko: {
                    // Permanent once published on addons.mozilla.org; Firefox ties stored notes to it
                    id: 'sticky-notes@bhavyab19',
                    // Firefox's built-in data consent (140+): this extension collects nothing
                    strict_min_version: '140.0',
                    data_collection_permissions: { required: ['none'] },
                },
            },
        }),
    }),
});
