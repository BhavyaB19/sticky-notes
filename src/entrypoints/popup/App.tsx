import { useEffect, useState } from 'react';
import type { ContentMessage } from '@/shared/messages';
import { notePreview } from '@/core/preview';
import { isSiteHidden, setSiteHidden } from '@/core/settings';
import { createNote, getNotesForUrl, onNotesChanged } from '@/core/storage';
import type { Note } from '@/core/types';
import { getUrlKeys } from '@/core/url';

type PageState =
    | { status: 'loading' }
    | { status: 'unsupported' }
    | { status: 'newtab' } // the extension's own new tab page
    | { status: 'ready'; tabId: number; url: string };

async function getActivePage(): Promise<PageState> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.startsWith(browser.runtime.getURL('/newtab.html'))) return { status: 'newtab' };
    if (tab?.id === undefined || !tab.url || !getUrlKeys(tab.url)) return { status: 'unsupported' };
    return { status: 'ready', tabId: tab.id, url: tab.url };
}

// The new tab page isn't a website, so there's no content script to message: save the note
// directly and the page draws it when storage changes
function addNewTabNote(): void {
    createNote({ scope: 'newtab', url: '', title: 'New tab', x: 24, y: 24 })
        .then(() => window.close())
        .catch(console.error);
}

function App() {
    const [page, setPage] = useState<PageState>({ status: 'loading' });
    const [notes, setNotes] = useState<Note[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hidden, setHidden] = useState(false);

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
        isSiteHidden(page.url).then(setHidden).catch(console.error);
        return onNotesChanged(load);
    }, [page]);

    const toggleHidden = (next: boolean) => {
        if (page.status !== 'ready') return;
        setHidden(next);
        setSiteHidden(page.url, next).catch(console.error);
    };

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

            {page.status === 'newtab' && (
                <div className="actions">
                    <button type="button" className="primary" onClick={addNewTabNote}>
                        + Note on new tab
                    </button>
                </div>
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

                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={hidden}
                            onChange={(e) => toggleHidden(e.target.checked)}
                        />
                        Hide notes on {getUrlKeys(page.url)?.siteKey}
                    </label>

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

            <button type="button" className="all-notes" onClick={openDashboard}>
                All notes →
            </button>
        </main>
    );
}

function openDashboard(): void {
    browser.tabs
        .create({ url: browser.runtime.getURL('/dashboard.html') })
        .then(() => window.close())
        .catch(console.error);
}

export default App;
