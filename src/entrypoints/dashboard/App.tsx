import { useEffect, useMemo, useRef, useState } from 'react';
import { BackupError, backupFileName, createBackup, parseBackup } from '@/core/backup';
import { filterNotes, groupBySite } from '@/core/group';
import { getHiddenSites, onHiddenSitesChanged, setSiteKeyHidden } from '@/core/settings';
import { deleteAllNotes, getAllNotes, importNotes, onNotesChanged } from '@/core/storage';
import type { Note } from '@/core/types';
import { NoteCard } from './NoteCard';
import { useConfirm } from './useConfirm';

interface Status {
    kind: 'info' | 'error';
    text: string;
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function downloadJson(data: unknown, fileName: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
    const [notes, setNotes] = useState<Note[] | null>(null);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<Status | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = () => {
            getAllNotes().then(setNotes).catch(console.error);
        };
        load();
        return onNotesChanged(load);
    }, []);

    const [hiddenSites, setHiddenSites] = useState<string[]>([]);
    useEffect(() => {
        const load = () => {
            getHiddenSites().then(setHiddenSites).catch(console.error);
        };
        load();
        return onHiddenSitesChanged(load);
    }, []);

    const groups = useMemo(() => groupBySite(filterNotes(notes ?? [], query)), [notes, query]);
    const shownCount = groups.reduce((sum, group) => sum + group.notes.length, 0);

    const exportNotes = () => {
        if (!notes) return;
        downloadJson(createBackup(notes), backupFileName());
        setStatus({ kind: 'info', text: `Exported ${plural(notes.length, 'note')}.` });
    };

    const importFile = async (file: File) => {
        try {
            const { notes: incoming, invalid } = parseBackup(await file.text());
            const result = await importNotes(incoming);
            const parts = [
                `${result.added} added`,
                `${result.updated} updated`,
                `${result.skipped} already up to date`,
            ];
            if (invalid > 0) parts.push(`${invalid} unreadable`);
            setStatus({ kind: 'info', text: `Import done: ${parts.join(', ')}.` });
        } catch (error) {
            const reason = error instanceof BackupError ? error.message : 'Something went wrong';
            setStatus({ kind: 'error', text: `Couldn't import ${file.name}: ${reason}.` });
        }
    };

    const removeAll = useConfirm(() => {
        deleteAllNotes()
            .then(() => setStatus({ kind: 'info', text: 'All notes deleted.' }))
            .catch(console.error);
    });

    return (
        <div className="page">
            <header className="topbar">
                <h1>Sticky Notes</h1>
                <input
                    type="search"
                    className="search"
                    placeholder="Search notes, titles or sites…"
                    aria-label="Search notes"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <div className="toolbar">
                    <button
                        type="button"
                        onClick={exportNotes}
                        disabled={!notes || notes.length === 0}
                    >
                        Export
                    </button>
                    <button type="button" onClick={() => fileInput.current?.click()}>
                        Import
                    </button>
                    <input
                        ref={fileInput}
                        type="file"
                        accept="application/json,.json"
                        hidden
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = ''; // allow picking the same file again
                            if (file) void importFile(file);
                        }}
                    />
                </div>
            </header>

            {status && (
                <p className={`status ${status.kind}`} role="status">
                    {status.text}
                    <button
                        type="button"
                        className="status-close"
                        aria-label="Dismiss"
                        onClick={() => setStatus(null)}
                    >
                        ×
                    </button>
                </p>
            )}

            {notes === null ? null : notes.length === 0 ? (
                <p className="empty">
                    No notes yet. Open any website and press Alt+Shift+N, or use the toolbar button.
                </p>
            ) : (
                <>
                    <p className="summary">
                        {query
                            ? `${plural(shownCount, 'note')} match “${query.trim()}”`
                            : `${plural(notes.length, 'note')} on ${plural(groups.length, 'site')}`}
                    </p>

                    {groups.map((group) => (
                        <section key={group.site} className="site">
                            <h2>
                                {group.site}
                                <span className="count">{group.notes.length}</span>
                                {hiddenSites.includes(group.site) && (
                                    <span className="hidden-tag">
                                        Hidden on this site
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSiteKeyHidden(group.site, false).catch(
                                                    console.error,
                                                );
                                            }}
                                        >
                                            Show
                                        </button>
                                    </span>
                                )}
                            </h2>
                            <div className="grid">
                                {group.notes.map((note) => (
                                    <NoteCard key={note.id} note={note} />
                                ))}
                            </div>
                        </section>
                    ))}

                    <footer className="danger">
                        <button
                            type="button"
                            className={removeAll.armed ? 'danger-button armed' : 'danger-button'}
                            onClick={removeAll.onClick}
                        >
                            {removeAll.armed
                                ? `Click again to delete all ${plural(notes.length, 'note')}`
                                : 'Delete all notes'}
                        </button>
                        <span className="hint">
                            Export a backup first if you might want them back.
                        </span>
                    </footer>
                </>
            )}
        </div>
    );
}

export default App;
