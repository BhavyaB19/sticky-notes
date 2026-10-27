import { NOTE_COLORS, type Note } from './types';

const APP = 'sticky-notes';
const VERSION = 1;

export interface Backup {
    app: typeof APP;
    version: number;
    exportedAt: string;
    notes: Note[];
}

export class BackupError extends Error {}

export function createBackup(notes: Note[], now = new Date()): Backup {
    return { app: APP, version: VERSION, exportedAt: now.toISOString(), notes };
}

export function backupFileName(now = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return `sticky-notes-${date}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

function isNote(value: unknown): value is Note {
    if (!isRecord(value)) return false;
    return (
        typeof value.id === 'string' &&
        value.id.length > 0 &&
        (value.scope === 'page' || value.scope === 'site') &&
        typeof value.url === 'string' &&
        typeof value.title === 'string' &&
        typeof value.content === 'string' &&
        (NOTE_COLORS as readonly unknown[]).includes(value.color) &&
        ['x', 'y', 'width', 'height', 'createdAt', 'updatedAt'].every((key) =>
            isFiniteNumber(value[key]),
        ) &&
        typeof value.minimized === 'boolean'
    );
}

// Throws BackupError if the text isn't a backup at all. Individual broken notes are
// left out and counted, so one bad entry doesn't block restoring the rest.
export function parseBackup(text: string): { notes: Note[]; invalid: number } {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new BackupError('Not a JSON file');
    }
    if (!isRecord(data) || data.app !== APP || !Array.isArray(data.notes)) {
        throw new BackupError('Not a Sticky Notes backup');
    }
    if (typeof data.version !== 'number' || data.version > VERSION) {
        throw new BackupError('Backup is from a newer version of Sticky Notes');
    }

    const notes = data.notes.filter(isNote);
    return { notes, invalid: data.notes.length - notes.length };
}
