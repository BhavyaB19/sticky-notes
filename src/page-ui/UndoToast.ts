const VISIBLE_MS = 5000;

// "Note deleted · Undo" bar at the bottom of the window. A new message replaces the old one,
// so only the most recent deletion can be undone.
export class UndoToast {
    readonly el: HTMLElement;
    private readonly message: HTMLElement;
    private onUndo: (() => void) | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        this.el = document.createElement('div');
        this.el.className = 'toast';
        this.el.setAttribute('role', 'status');
        this.el.setAttribute('aria-live', 'polite');
        this.el.hidden = true;

        this.message = document.createElement('span');
        const undoButton = document.createElement('button');
        undoButton.type = 'button';
        undoButton.className = 'toast-button';
        undoButton.textContent = 'Undo';
        undoButton.addEventListener('click', () => {
            const undo = this.onUndo;
            this.hide();
            undo?.();
        });
        this.el.append(this.message, undoButton);
    }

    show(text: string, onUndo: () => void): void {
        this.message.textContent = text;
        this.onUndo = onUndo;
        this.el.hidden = false;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.hide(), VISIBLE_MS);
    }

    hide(): void {
        clearTimeout(this.timer);
        this.onUndo = undefined;
        this.el.hidden = true;
    }

    destroy(): void {
        this.hide();
        this.el.remove();
    }
}
