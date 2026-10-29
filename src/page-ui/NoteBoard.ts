import { restoreNote } from '@/core/storage';
import type { Note } from '@/core/types';
import { NoteView } from './NoteView';
import { UndoToast } from './UndoToast';

function reportError(error: unknown): void {
    console.error('[sticky-notes]', error);
}

export interface NoteBoardOptions {
    getPage(): { url: string; title: string }; // the page the user is on right now
}

// Draws a set of notes into a container and keeps them on screen as they change: one NoteView
// per note, click-to-front, focusing new notes and "Note deleted · Undo". Used for notes on
// websites (NotesLayer) and on the extension's new tab page.
export class NoteBoard {
    private readonly container: HTMLElement;
    private readonly options: NoteBoardOptions;
    private readonly views = new Map<string, NoteView>();
    private readonly toast = new UndoToast();
    private topZ = 0;
    // A note to focus once it's drawn; `reveal` also scrolls to it and expands it
    private pendingFocus: { id: string; reveal: boolean } | undefined;

    constructor(container: HTMLElement, options: NoteBoardOptions) {
        this.container = container;
        this.options = options;
        this.container.append(this.toast.el);
    }

    // Reconciles by id instead of redrawing, so typing and dragging aren't interrupted
    render(notes: Note[]): void {
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
                onDeleted: (deleted) => {
                    this.toast.show('Note deleted', () => {
                        restoreNote(deleted).catch(reportError);
                    });
                },
                getPage: () => this.options.getPage(),
            });
            view.el.style.zIndex = String(++this.topZ);
            this.views.set(note.id, view);
            this.container.append(view.el);
        }

        const pending = this.pendingFocus;
        const focusView = pending ? this.views.get(pending.id) : undefined;
        if (pending && focusView) {
            this.pendingFocus = undefined;
            this.bringToFront(focusView);
            if (pending.reveal) focusView.reveal();
            else focusView.focus();
        }
    }

    // Focuses the note the next time it's drawn (e.g. right after creating it)
    focusWhenDrawn(id: string, reveal = false): void {
        this.pendingFocus = { id, reveal };
    }

    // Scrolls to a note that's already drawn; false if it isn't on the board
    reveal(id: string): boolean {
        const view = this.views.get(id);
        if (!view) return false;
        this.bringToFront(view);
        view.reveal();
        return true;
    }

    // Saves any text typed in the last moments, e.g. right before the tab closes
    flushAll(): void {
        for (const view of this.views.values()) view.flush();
    }

    destroy(): void {
        this.flushAll();
        for (const view of this.views.values()) view.destroy();
        this.views.clear();
        this.toast.destroy();
    }

    private bringToFront(view: NoteView): void {
        if (view.el.style.zIndex === String(this.topZ)) return;
        view.el.style.zIndex = String(++this.topZ);
    }
}
