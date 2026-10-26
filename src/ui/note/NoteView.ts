import { debounce, type Debounced } from '@/lib/debounce';
import { deleteNote, updateNote } from '@/lib/storage';
import type { Note, NoteChanges, NoteColor } from '@/lib/types';
import { makeDraggable } from './drag';
import { makeResizable } from './resize';

const COLORS: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple'];
const SAVE_DELAY_MS = 400;
const DELETE_CONFIRM_MS = 3000;

export interface NoteViewCallbacks {
    onFocus(view: NoteView): void;
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
    private readonly minimizeButton: HTMLButtonElement;
    private readonly deleteButton: HTMLButtonElement;
    private readonly swatches: HTMLElement;
    private readonly saveContent: Debounced<[string]>;
    private readonly cleanups: Array<() => void> = [];
    private deleteTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(note: Note, callbacks: NoteViewCallbacks) {
        this.note = note;
        this.callbacks = callbacks;

        this.el = document.createElement('div');
        this.el.className = 'note';

        const header = document.createElement('div');
        header.className = 'note-header';
        const colorButton = button('note-button', 'Change color', '🎨');
        const spacer = document.createElement('span');
        spacer.className = 'spacer';
        this.minimizeButton = button('note-button', 'Minimize', '–');
        this.deleteButton = button('note-button delete', 'Delete note', '🗑');
        header.append(colorButton, spacer, this.minimizeButton, this.deleteButton);

        this.swatches = document.createElement('div');
        this.swatches.className = 'swatches';
        this.swatches.hidden = true;
        for (const color of COLORS) {
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
        // Capture phase, so clicking anywhere on the note (even a button) raises it
        this.el.addEventListener('pointerdown', () => this.callbacks.onFocus(this), true);
        colorButton.addEventListener('click', () => {
            this.swatches.hidden = !this.swatches.hidden;
        });
        this.minimizeButton.addEventListener('click', () => this.toggleMinimized());
        this.deleteButton.addEventListener('click', () => this.onDeleteClick());

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

    // Saves any text typed in the last moments, e.g. right before the tab closes
    flush(): void {
        this.saveContent.flush();
    }

    destroy(): void {
        this.saveContent.cancel();
        clearTimeout(this.deleteTimer);
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

        if (note.x !== previous?.x) this.el.style.left = `${note.x}px`;
        if (note.y !== previous?.y) this.el.style.top = `${note.y}px`;
        if (note.width !== previous?.width) this.el.style.width = `${note.width}px`;
        if (note.height !== previous?.height) this.el.style.height = `${note.height}px`;

        const root = this.el.getRootNode() as Document | ShadowRoot;
        const isTyping = root.activeElement === this.textarea;
        if (note.content !== previous?.content && !isTyping) this.textarea.value = note.content;
    }

    private save(changes: NoteChanges): void {
        updateNote(this.note, changes)
            .then((note) => {
                this.note = note;
            })
            .catch(reportError);
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

    // First click arms the button, a second click within a few seconds deletes
    private onDeleteClick(): void {
        if (this.deleteTimer !== undefined) {
            clearTimeout(this.deleteTimer);
            this.deleteTimer = undefined;
            this.saveContent.cancel();
            deleteNote(this.note).catch(reportError);
            return;
        }

        this.deleteButton.classList.add('armed');
        this.deleteButton.textContent = 'Delete?';
        this.deleteTimer = setTimeout(() => {
            this.deleteTimer = undefined;
            this.deleteButton.classList.remove('armed');
            this.deleteButton.textContent = '🗑';
        }, DELETE_CONFIRM_MS);
    }
}
