import { useEffect, useState } from 'react';
import type { ContentMessage } from '@/lib/messages';
import { notePreview } from '@/lib/preview';
import { getNotesForUrl, onNotesChanged } from '@/lib/storage';
import type { Note } from '@/lib/types';
import { getUrlKeys } from '@/lib/url';

type PageState =
    | { status: 'loading' }
    | { status: 'unsupported' }
    | { status: 'ready'; tabId: number; url: string };

async function getActivePage(): Promise<PageState> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined || !tab.url || !getUrlKeys(tab.url)) return { status: 'unsupported' };
    return { status: 'ready', tabId: tab.id, url: tab.url };
}

function App() {
    const [page, setPage] = useState<PageState>({ status: 'loading' });
    const [notes, setNotes] = useState<Note[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getActivePage()
            .then(setPage)
            .catch(() => setPage({ status: 'unsupported' }));
    }, []);

    useEffect(() => {
        if (page.status !== 'ready') return;
        const load = () => {
            getNotesForUrl(page.url).then(setNotes).catch(console.error);
        };
        load();
        return onNotesChanged(load);
    }, [page]);

    const send = async (message: ContentMessage) => {
        if (page.status !== 'ready') return;
        try {
            await browser.tabs.sendMessage(page.tabId, message);
            window.close();
        } catch {
            // The tab was opened before the extension was installed or reloaded
            setError('Reload this page to use notes here.');
        }
    };

    return (
        <main className="popup">
            <h1>Sticky Notes</h1>

            {page.status === 'unsupported' && (
                <p className="message">Notes can't be added on this page.</p>
            )}

            {page.status === 'ready' && (
                <>
                    <div className="actions">
                        <button
                            type="button"
                            className="primary"
                            onClick={() => void send({ type: 'add-note', scope: 'page' })}
                        >
                            + Note on this page
                        </button>
                        <button
                            type="button"
                            onClick={() => void send({ type: 'add-note', scope: 'site' })}
                        >
                            + Note on whole site
                        </button>
                    </div>

                    {error && (
                        <p className="message error" role="alert">
                            {error}
                        </p>
                    )}

                    <section>
                        <h2>On this page ({notes.length})</h2>
                        {notes.length === 0 ? (
                            <p className="empty">No notes here yet.</p>
                        ) : (
                            <ul className="note-list">
                                {notes.map((note) => (
                                    <li key={note.id}>
                                        <button
                                            type="button"
                                            className="note-item"
                                            onClick={() =>
                                                void send({ type: 'focus-note', id: note.id })
                                            }
                                        >
                                            <span className="dot" data-color={note.color} />
                                            <span className="preview">
                                                {notePreview(note.content)}
                                            </span>
                                            <span
                                                className="scope"
                                                title={
                                                    note.scope === 'page'
                                                        ? 'This page'
                                                        : 'Whole site'
                                                }
                                            >
                                                {note.scope === 'page' ? '📄' : '🌐'}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </main>
    );
}

export default App;
