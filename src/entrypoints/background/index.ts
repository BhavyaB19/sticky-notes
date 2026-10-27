import { badgeText } from './badge';
import type { BackgroundMessage, ContentMessage } from '@/shared/messages';

const MENU_ID = 'add-note';
const COMMAND_ADD_NOTE = 'add-note';
const BADGE_COLOR = '#f9a825';

function sendToTab(tabId: number, message: ContentMessage): void {
    // Fails on pages without the content script (chrome://, or tabs opened before install)
    browser.tabs.sendMessage(tabId, message).catch(() => undefined);
}

export default defineBackground(() => {
    // Chrome keeps menu items across restarts, so create them only on install/update
    browser.runtime.onInstalled.addListener(() => {
        browser.contextMenus.create({
            id: MENU_ID,
            title: 'Add sticky note here',
            contexts: ['page', 'selection'],
            documentUrlPatterns: ['http://*/*', 'https://*/*'],
        });
    });

    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
        sendToTab(tab.id, {
            type: 'add-note',
            scope: 'page',
            atContextMenu: true,
            content: info.selectionText,
        });
    });

    browser.commands.onCommand.addListener((command, tab) => {
        if (command !== COMMAND_ADD_NOTE) return;
        if (tab?.id !== undefined) {
            sendToTab(tab.id, { type: 'add-note', scope: 'page' });
            return;
        }
        browser.tabs
            .query({ active: true, currentWindow: true })
            .then(([active]) => {
                if (active?.id !== undefined)
                    sendToTab(active.id, { type: 'add-note', scope: 'page' });
            })
            .catch(() => undefined);
    });

    void browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });

    browser.runtime.onMessage.addListener((message: unknown, sender) => {
        const msg = message as BackgroundMessage;
        const tabId = sender.tab?.id;
        if (msg.type !== 'notes-count' || tabId === undefined) return;
        void browser.action.setBadgeText({ tabId, text: badgeText(msg.count) });
    });

    // A new page reports its own count; pages without the content script must not keep an old one
    browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === 'loading' && changeInfo.url) {
            void browser.action.setBadgeText({ tabId, text: '' });
        }
    });
});
