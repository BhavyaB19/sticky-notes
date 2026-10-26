// crypto.randomUUID only exists on HTTPS pages, and content scripts also run on plain HTTP
export function createId(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
