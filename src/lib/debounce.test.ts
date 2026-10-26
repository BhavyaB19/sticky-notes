import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs once after the delay with the latest arguments', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 400);

        debounced('a');
        vi.advanceTimersByTime(200);
        debounced('b');
        vi.advanceTimersByTime(399);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('b');
    });

    it('flush() runs the pending call immediately, only once', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 400);

        debounced('a');
        debounced.flush();
        expect(fn).toHaveBeenCalledWith('a');

        vi.advanceTimersByTime(400);
        debounced.flush();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('flush() does nothing when no call is pending', () => {
        const fn = vi.fn();
        debounce(fn, 400).flush();

        expect(fn).not.toHaveBeenCalled();
    });

    it('cancel() drops the pending call', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 400);

        debounced('a');
        debounced.cancel();
        vi.advanceTimersByTime(400);
        debounced.flush();

        expect(fn).not.toHaveBeenCalled();
    });
});
