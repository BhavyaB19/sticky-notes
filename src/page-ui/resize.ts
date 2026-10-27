export const MIN_WIDTH = 160;
export const MIN_HEIGHT = 100;

interface ResizeStart {
    pointerX: number;
    pointerY: number;
    width: number;
    height: number;
}

// Resizes `target` by dragging `handle` (the bottom-right corner). Sizes are read from and
// written to the target's inline width/height. Returns a cleanup function.
export function makeResizable(
    handle: HTMLElement,
    target: HTMLElement,
    onEnd: (width: number, height: number) => void,
): () => void {
    let start: ResizeStart | null = null;

    const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        start = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            width: parseFloat(target.style.width) || target.offsetWidth,
            height: parseFloat(target.style.height) || target.offsetHeight,
        };
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!start) return;
        const width = Math.max(MIN_WIDTH, start.width + e.clientX - start.pointerX);
        const height = Math.max(MIN_HEIGHT, start.height + e.clientY - start.pointerY);
        target.style.width = `${width}px`;
        target.style.height = `${height}px`;
    };

    const onPointerUp = () => {
        if (!start) return;
        const width = parseFloat(target.style.width);
        const height = parseFloat(target.style.height);
        const resized = width !== start.width || height !== start.height;
        start = null;
        if (resized) onEnd(width, height);
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
