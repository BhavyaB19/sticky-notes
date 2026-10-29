import { debounce, type Debounced } from '@/shared/debounce';
import { changeScope, deleteNote, updateNote } from '@/core/storage';
import { NOTE_COLORS, type Note, type NoteChanges, type NoteColor } from '@/core/types';
import { makeDraggable } from './drag';
import { makeResizable } from './resize';

const SAVE_DELAY_MS = 400;

export interface NoteViewCallbacks {
    onFocus(view: NoteView): void;
    onDeleted(note: Note): void; // after the note is gone from storage, so it can be undone
    getPage(): { url: string; title: string }; // the page the user is on right now
}

function button(className: string, label: string, text: string): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.title = label;
    el.setAttribute('aria-label', label);
    el.textContent = text;
    return el;
}

function reportError(error: unknown): void {
    console.error('[sticky-notes]', error);
}

// One note on the page. Renders from a Note and saves the user's changes back to storage.
export class NoteView {
    readonly el: HTMLElement;
    private note: Note;
    private readonly callbacks: NoteViewCallbacks;
    private readonly textarea: HTMLTextAreaElement;
    private readonly scopeButton: HTMLButtonElement;
    private readonly minimizeButton: HTMLButtonElement;
    private readonly swatches: HTMLElement;
    private readonly saveContent: Debounced<[string]>;
    private readonly cleanups: Array<() => void> = [];
    private writes: Promise<void> = Promise.resolve();

    constructor(note: Note, callbacks: NoteViewCallbacks) {
        this.note = note;
        this.callbacks = callbacks;

        this.el = document.createElement('div');
        this.el.className = 'note';

        const header = document.createElement('div');
        header.className = 'note-header';
        // "optional" buttons are hidden on very narrow notes (see style.css)
        const colorButton = button('note-button optional', 'Change color', '🎨');
        this.scopeButton = button('note-button optional', '', ''); // label set in render()
        const spacer = document.createElement('span');
        spacer.className = 'spacer';
        this.minimizeButton = button('note-button', 'Minimize', '–');
        const deleteButton = button('note-button', 'Delete note', '🗑');
        header.append(colorButton, this.scopeButton, spacer, this.minimizeButton, deleteButton);

        this.swatches = document.createElement('div');
        this.swatches.className = 'swatches';
        this.swatches.hidden = true;
        for (const color of NOTE_COLORS) {
            const swatch = button('swatch', `${color[0]?.toUpperCase()}${color.slice(1)}`, '');
            swatch.dataset.color = color;
            swatch.addEventListener('click', () => this.setColor(color));
            this.swatches.append(swatch);
        }

        this.textarea = document.createElement('textarea');
        this.textarea.className = 'note-body';
        this.textarea.placeholder = 'Write a note…';

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';

        this.el.append(header, this.swatches, this.textarea, resizeHandle);

        this.saveContent = debounce((content: string) => this.save({ content }), SAVE_DELAY_MS);

        this.textarea.addEventListener('input', () => this.saveContent(this.textarea.value));
        this.textarea.addEventListener('blur', () => this.saveContent.flush());
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.textarea.blur(); // leave the note, back to the page
        });
        // Capture phase, so clicking anywhere on the note (even a button) raises it
        this.el.addEventListener('pointerdown', () => this.callbacks.onFocus(this), true);
        colorButton.addEventListener('click', () => {
            this.swatches.hidden = !this.swatches.hidden;
        });
        this.scopeButton.addEventListener('click', () => this.toggleScope());
        this.minimizeButton.addEventListener('click', () => this.toggleMinimized());
        deleteButton.addEventListener('click', () => this.delete());
        this.el.addEventListener('animationend', () => this.el.classList.remove('highlight'));

        this.cleanups.push(
            makeDraggable(header, this.el, (x, y) => this.save({ x, y })),
            makeResizable(resizeHandle, this.el, (width, height) => this.save({ width, height })),
        );

        this.render(note, null);
    }

    get id(): string {
        return this.note.id;
    }

    update(note: Note): void {
        const previous = this.note;
        this.note = note;
        this.render(note, previous);
    }

    focus(): void {
        this.textarea.focus();
    }

    // Helps the user find the note: expands it, scrolls to it, focuses it and pulses it
    reveal(): void {
        if (this.note.minimized) this.toggleMinimized();
        this.textarea.focus({ preventScroll: true });
        this.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        this.el.classList.remove('highlight');
        void this.el.offsetWidth; // restarts the animation if it's already running
        this.el.classList.add('highlight');
    }

    // Saves any text typed in the last moments, e.g. right before the tab closes
    flush(): void {
        this.saveContent.flush();
    }

    destroy(): void {
        this.saveContent.cancel();
        for (const cleanup of this.cleanups) cleanup();
        this.el.remove();
    }

    // Only touches what changed since `previous`, so a storage update that arrives
    // mid-drag or mid-typing doesn't snap the note back or move the cursor
    private render(note: Note, previous: Note | null): void {
        this.el.dataset.color = note.color;
        this.el.dataset.minimized = String(note.minimized);
        this.minimizeButton.textContent = note.minimized ? '+' : '–';
        this.minimizeButton.title = note.minimized ? 'Expand' : 'Minimize';
        this.minimizeButton.setAttribute('aria-label', this.minimizeButton.title);
        // New tab notes aren't on a website, so there's nothing to switch between.
        // (Inline style: the button's `all: unset` would override the `hidden` attribute.)
        this.scopeButton.style.display = note.scope === 'newtab' ? 'none' : '';
        this.scopeButton.textContent = note.scope === 'page' ? '📄' : '🌐';
        this.scopeButton.title =
            note.scope === 'page'
                ? 'Shown on this page only. Click to show on the whole site'
                : 'Shown on the whole site. Click to show on this page only';
        this.scopeButton.setAttribute('aria-label', this.scopeButton.title);

        if (note.x !== previous?.x) this.el.style.left = `${note.x}px`;
        if (note.y !== previous?.y) this.el.style.top = `${note.y}px`;
        if (note.width !== previous?.width) this.el.style.width = `${note.width}px`;
        if (note.height !== previous?.height) this.el.style.height = `${note.height}px`;

        const root = this.el.getRootNode() as Document | ShadowRoot;
        const isTyping = root.activeElement === this.textarea;
        if (note.content !== previous?.content && !isTyping) this.textarea.value = note.content;
    }

    // Runs this note's storage writes one at a time. Each write reads this.note only when its
    // turn comes, so it sees the result of the previous one (e.g. a text save after a scope
    // change goes to the new bucket instead of failing to find the note in the old one).
    private enqueue(write: () => Promise<Note | void>): void {
        this.writes = this.writes
            .then(write)
            .then((note) => {
                if (note) this.note = note;
            })
            .catch(reportError);
    }

    private save(changes: NoteChanges): void {
        this.enqueue(() => updateNote(this.note, changes));
    }

    private toggleScope(): void {
        if (this.note.scope === 'newtab') return;
        const scope = this.note.scope === 'page' ? 'site' : 'page';
        this.saveContent.flush(); // queue pending text before the move
        this.enqueue(() => changeScope(this.note, scope, this.callbacks.getPage()));
    }

    private setColor(color: NoteColor): void {
        this.swatches.hidden = true;
        this.el.dataset.color = color;
        this.save({ color });
    }

    private toggleMinimized(): void {
        const minimized = !this.note.minimized;
        this.update({ ...this.note, minimized });
        this.save({ minimized });
    }

    // Deletes right away; the page layer then offers to undo with the copy passed to onDeleted
    private delete(): void {
        this.saveContent.cancel();
        const content = this.textarea.value; // includes text typed in the last moments
        this.enqueue(async () => {
            const deleted: Note = { ...this.note, content };
            await deleteNote(deleted);
            this.callbacks.onDeleted(deleted);
        });
    }
}
