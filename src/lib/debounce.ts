export interface Debounced<A extends unknown[]> {
    (...args: A): void;
    flush(): void; // run the pending call now
    cancel(): void; // drop the pending call
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingArgs: A | undefined;

    const run = () => {
        clearTimeout(timer);
        timer = undefined;
        if (!pendingArgs) return;
        const args = pendingArgs;
        pendingArgs = undefined;
        fn(...args);
    };

    const debounced = (...args: A) => {
        pendingArgs = args;
        clearTimeout(timer);
        timer = setTimeout(run, ms);
    };
    debounced.flush = run;
    debounced.cancel = () => {
        clearTimeout(timer);
        timer = undefined;
        pendingArgs = undefined;
    };
    return debounced;
}
