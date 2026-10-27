import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
    srcDir: 'src',
    modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
    // Every icon size is generated from this one file (greyed out during `npm run dev`)
    autoIcons: { baseIconPath: 'assets/icon.svg' },
    manifest: {
        name: 'Sticky Notes',
        description: 'Stick notes on any webpage. They stay until you delete them.',
        permissions: ['storage', 'contextMenus', 'activeTab'],
        commands: {
            'add-note': {
                suggested_key: { default: 'Alt+Shift+N' },
                description: 'Add a sticky note to this page',
            },
        },
    },
});
