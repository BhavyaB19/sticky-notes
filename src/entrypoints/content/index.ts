import './style.css';
import type { ContentMessage } from '@/shared/messages';
import { getUrlKeys } from '@/core/url';
import { NotesLayer } from '@/page-ui/NotesLayer';

export default defineContentScript({
    matches: ['<all_urls>'],
    cssInjectionMode: 'ui', // style.css goes into the Shadow DOM, not the page
    async main(ctx) {
        if (!getUrlKeys(location.href)) return; // notes can't live on this page

        const ui = await createShadowRootUi(ctx, {
            name: 'sticky-notes-layer', // custom element name, needs a hyphen
            position: 'inline',
            // <html> rather than <body>: sites that transform or offset <body> would shift every note
            anchor: 'html',
            mode: 'closed', // page scripts can't reach into the notes
            isolateEvents: true, // typing in a note doesn't trigger the page's keyboard shortcuts
            onMount: (container) => {
                const layer = new NotesLayer(container, ctx);
                layer.start().catch((error: unknown) => console.error('[sticky-notes]', error));
                return layer;
            },
            onRemove: (layer) => layer?.destroy(),
        });
        ui.mount();

        // From the popup, right-click menu and keyboard shortcut (via the background worker)
        const onMessage = (
            message: unknown,
            _sender: unknown,
            sendResponse: (response: unknown) => void,
        ) => {
            ui.mounted?.handleMessage(message as ContentMessage);
            // Always answer, so the sender can tell "handled" apart from "no content script here"
            sendResponse({ ok: true });
        };
        browser.runtime.onMessage.addListener(onMessage);
        ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(onMessage));
    },
});
