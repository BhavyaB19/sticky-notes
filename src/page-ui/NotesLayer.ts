import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { BackgroundMessage, ContentMessage } from '@/shared/messages';
import { isSiteHidden, onHiddenSitesChanged, setSiteHidden } from '@/core/settings';
import { createNote, getNotesForUrl, onNotesChanged } from '@/core/storage';
import { DEFAULT_WIDTH, type Scope } from '@/core/types';
import { NoteBoard } from './NoteBoard';

// Distance from the top of the visible area for new notes
const NEW_NOTE_TOP_OFFSET = 80;

interface Point {
    x: number;
    y: number;
}

export interface AddNoteOptions {
    scope: Scope;
    position?: Point; // page coordinates; defaults to near the top of the visible area
    content?: string;
}

function reportError(error: unknown): void {
    console.error('[sticky-notes]', error);
}

// The notes on a website: loads the page's notes, keeps them in sync with storage, follows
// single-page navigation, handles messages from the popup/background and updates the badge
export class NotesLayer {
    private readonly ctx: ContentScriptContext;
    private readonly board: NoteBoard;
    private loadSeq = 0;
    private lastContextMenu: Point | undefined;
    private reportedCount: number | undefined;
    private hidden = false; // the user hid notes on this site
    private unsubscribes: Array<() => void> = [];
    // Tracked here instead of reading location.href: on single-page sites the change event
    // arrives before location.href is updated
    private pageUrl = location.href;

    constructor(container: HTMLElement, ctx: ContentScriptContext) {
        this.ctx = ctx;
        this.board = new NoteBoard(container, {
            getPage: () => ({ url: this.pageUrl, title: document.title }),
        });
    }

    async start(): Promise<void> {
        this.unsubscribes.push(
            onNotesChanged(() => void this.reload()),
            onHiddenSitesChanged(() => void this.reload()),
        );
        // Single-page sites (YouTube, GitHub, ...) change the URL without reloading the page
        this.ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
            this.onLocationChange(newUrl.href);
        });
        // The context menu click reaches the background without coordinates, so remember them here
        this.ctx.addEventListener(
            window,
            'contextmenu',
            (e) => {
                this.lastContextMenu = { x: e.pageX, y: e.pageY };
            },
            { capture: true },
        );
        this.ctx.addEventListener(window, 'pagehide', () => this.board.flushAll());
        this.ctx.addEventListener(document, 'visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.board.flushAll();
        });
        await this.reload();
    }

    destroy(): void {
        for (const unsubscribe of this.unsubscribes) unsubscribe();
        this.unsubscribes = [];
        this.board.destroy();
    }

    handleMessage(message: ContentMessage): void {
        switch (message.type) {
            case 'add-note':
                this.addNote({
                    scope: message.scope,
                    position: message.atContextMenu ? this.lastContextMenu : undefined,
                    content: message.content,
                }).catch(reportError);
                break;
            case 'focus-note':
                this.focusNote(message.id);
                break;
        }
    }

    async addNote({ scope, position, content }: AddNoteOptions): Promise<void> {
        const note = await createNote({
            scope,
            url: this.pageUrl,
            title: document.title,
            content,
            x: Math.round(position?.x ?? Math.max(0, scrollX + innerWidth / 2 - DEFAULT_WIDTH / 2)),
            y: Math.round(position?.y ?? scrollY + NEW_NOTE_TOP_OFFSET),
        });
        this.board.focusWhenDrawn(note.id);
        // Adding a note means the user wants to see notes here again
        if (this.hidden) await setSiteHidden(this.pageUrl, false);
        await this.reload();
    }

    focusNote(id: string): void {
        if (this.board.reveal(id)) return;
        // Picked from the popup's list while this site's notes are hidden: show them again
        if (this.hidden) {
            this.board.focusWhenDrawn(id, true);
            setSiteHidden(this.pageUrl, false).catch(reportError);
        }
    }

    private onLocationChange(url: string): void {
        this.board.flushAll(); // text typed on the old page still goes to that page's notes
        this.pageUrl = url;
        // The background clears the badge on navigation, so report even an unchanged count
        this.reportedCount = undefined;
        void this.reload();
    }

    private async reload(): Promise<void> {
        // Saves fire change events quickly; only the newest load may render
        const seq = ++this.loadSeq;
        const [notes, hidden] = await Promise.all([
            getNotesForUrl(this.pageUrl),
            isSiteHidden(this.pageUrl),
        ]);
        if (seq !== this.loadSeq || !this.ctx.isValid) return;
        this.hidden = hidden;
        this.board.render(hidden ? [] : notes);
        // The badge counts hidden notes too, as a reminder that they exist
        this.reportCount(notes.length);
    }

    // Keeps the toolbar badge in sync with the number of notes on this page
    private reportCount(count: number): void {
        if (count === this.reportedCount) return;
        this.reportedCount = count;
        const message: BackgroundMessage = { type: 'notes-count', count };
        // Fails only while the extension is reloading; the next render reports again
        browser.runtime.sendMessage(message).catch(() => {
            this.reportedCount = undefined;
        });
    }
}
