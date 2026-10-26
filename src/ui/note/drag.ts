// How much of a note must stay inside the page horizontally, so it can't be lost off the right edge
const MIN_VISIBLE = 40;

interface DragStart {
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
}

// Moves `target` by dragging `handle`. Positions are read from and written to the target's
// inline left/top, which NoteView keeps as the source of truth. Returns a cleanup function.
export function makeDraggable(
    handle: HTMLElement,
    target: HTMLElement,
    onEnd: (x: number, y: number) => void,
): () => void {
    let start: DragStart | null = null;

    const onPointerDown = (e: PointerEvent) => {
        // Clicks on header buttons (delete, color, ...) must not start a drag
        if (e.button !== 0 || (e.target as Element).closest('button')) return;
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        start = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            x: parseFloat(target.style.left) || 0,
            y: parseFloat(target.style.top) || 0,
        };
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!start) return;
        const maxX = Math.max(0, document.documentElement.scrollWidth - MIN_VISIBLE);
        const x = Math.min(Math.max(0, start.x + e.clientX - start.pointerX), maxX);
        const y = Math.max(0, start.y + e.clientY - start.pointerY);
        target.style.left = `${x}px`;
        target.style.top = `${y}px`;
    };

    const onPointerUp = () => {
        if (!start) return;
        const x = parseFloat(target.style.left) || 0;
        const y = parseFloat(target.style.top) || 0;
        const moved = x !== start.x || y !== start.y;
        start = null;
        if (moved) onEnd(x, y);
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
    return () => {
        handle.removeEventListener('pointerdown', onPointerDown);
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);
    };
}
