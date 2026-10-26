import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { BackgroundMessage, ContentMessage } from '@/lib/messages';
import { createNote, getNotesForUrl, onNotesChanged } from '@/lib/storage';
import { DEFAULT_WIDTH, type Note, type Scope } from '@/lib/types';
import { NoteView } from '@/ui/note/NoteView';

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

// Owns every note on the current page: loads them, draws them and keeps them in sync with storage
export class NotesLayer {
    private readonly container: HTMLElement;
    private readonly ctx: ContentScriptContext;
    private readonly views = new Map<string, NoteView>();
    private topZ = 0;
    private loadSeq = 0;
    private pendingFocusId: string | undefined;
    private lastContextMenu: Point | undefined;
    private reportedCount: number | undefined;
    private unsubscribe: (() => void) | undefined;
    // Tracked here instead of reading location.href: on single-page sites the change event
    // arrives before location.href is updated
    private pageUrl = location.href;

    constructor(container: HTMLElement, ctx: ContentScriptContext) {
        this.container = container;
        this.ctx = ctx;
    }

    async start(): Promise<void> {
        this.unsubscribe = onNotesChanged(() => void this.reload());
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
        this.ctx.addEventListener(window, 'pagehide', () => this.flushAll());
        this.ctx.addEventListener(document, 'visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.flushAll();
        });
        await this.reload();
    }

    destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.flushAll();
        for (const view of this.views.values()) view.destroy();
        this.views.clear();
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
        this.pendingFocusId = note.id;
        await this.reload();
    }

    focusNote(id: string): void {
        const view = this.views.get(id);
        if (!view) return;
        this.bringToFront(view);
        view.reveal();
    }

    private onLocationChange(url: string): void {
        this.flushAll(); // text typed on the old page still goes to that page's notes
        this.pageUrl = url;
        // The background clears the badge on navigation, so report even an unchanged count
        this.reportedCount = undefined;
        void this.reload();
    }

    private async reload(): Promise<void> {
        // Saves fire change events quickly; only the newest load may render
        const seq = ++this.loadSeq;
        const notes = await getNotesForUrl(this.pageUrl);
        if (seq !== this.loadSeq || !this.ctx.isValid) return;
        this.render(notes);
    }

    // Reconciles by id instead of redrawing, so typing and dragging aren't interrupted
    private render(notes: Note[]): void {
        const ids = new Set(notes.map((note) => note.id));
        for (const [id, view] of this.views) {
            if (ids.has(id)) continue;
            view.destroy();
            this.views.delete(id);
        }

        for (const note of notes) {
            const existing = this.views.get(note.id);
            if (existing) {
                existing.update(note);
                continue;
            }
            const view = new NoteView(note, {
                onFocus: (v) => this.bringToFront(v),
                getPage: () => ({ url: this.pageUrl, title: document.title }),
            });
            view.el.style.zIndex = String(++this.topZ);
            this.views.set(note.id, view);
            this.container.append(view.el);
        }

        const focusView = this.pendingFocusId ? this.views.get(this.pendingFocusId) : undefined;
        if (focusView) {
            this.pendingFocusId = undefined;
            this.bringToFront(focusView);
            focusView.focus();
        }

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

    private bringToFront(view: NoteView): void {
        if (view.el.style.zIndex === String(this.topZ)) return;
        view.el.style.zIndex = String(++this.topZ);
    }

    private flushAll(): void {
        for (const view of this.views.values()) view.flush();
    }
}
