import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createNote, getNotesForUrl, onNotesChanged } from '@/lib/storage';
import { DEFAULT_WIDTH, type Note } from '@/lib/types';
import { NoteView } from '@/ui/note/NoteView';

// Distance from the top of the visible area for new notes
const NEW_NOTE_TOP_OFFSET = 80;

function isAddNoteShortcut(e: KeyboardEvent): boolean {
    // e.code, not e.key: Alt+Shift changes e.key on some keyboard layouts
    return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyN';
}

// Owns every note on the current page: loads them, draws them and keeps them in sync with storage
export class NotesLayer {
    private readonly container: HTMLElement;
    private readonly ctx: ContentScriptContext;
    private readonly views = new Map<string, NoteView>();
    private topZ = 0;
    private loadSeq = 0;
    private pendingFocusId: string | undefined;
    private unsubscribe: (() => void) | undefined;

    constructor(container: HTMLElement, ctx: ContentScriptContext) {
        this.container = container;
        this.ctx = ctx;
    }

    async start(): Promise<void> {
        this.unsubscribe = onNotesChanged(() => void this.reload());
        // Capture phase on window, so the shortcut also works while typing inside a note
        this.ctx.addEventListener(window, 'keydown', (e) => this.onKeyDown(e), { capture: true });
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

    async addNote(): Promise<void> {
        const note = await createNote({
            scope: 'page',
            url: location.href,
            title: document.title,
            x: Math.max(0, Math.round(scrollX + innerWidth / 2 - DEFAULT_WIDTH / 2)),
            y: Math.round(scrollY + NEW_NOTE_TOP_OFFSET),
        });
        this.pendingFocusId = note.id;
        await this.reload();
    }

    private async reload(): Promise<void> {
        // Saves fire change events quickly; only the newest load may render
        const seq = ++this.loadSeq;
        const notes = await getNotesForUrl(location.href);
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
            const view = new NoteView(note, { onFocus: (v) => this.bringToFront(v) });
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
    }

    private bringToFront(view: NoteView): void {
        if (view.el.style.zIndex === String(this.topZ)) return;
        view.el.style.zIndex = String(++this.topZ);
    }

    private flushAll(): void {
        for (const view of this.views.values()) view.flush();
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (!isAddNoteShortcut(e) || e.repeat) return;
        e.preventDefault();
        e.stopPropagation();
        this.addNote().catch((error: unknown) => console.error('[sticky-notes]', error));
    }
}
