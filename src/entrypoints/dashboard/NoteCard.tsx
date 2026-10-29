import { useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from '@/shared/debounce';
import { deleteNote, updateNote } from '@/core/storage';
import type { Note, Scope } from '@/core/types';
import { useConfirm } from './useConfirm';

const SAVE_DELAY_MS = 400;
const NEW_TAB_URL = browser.runtime.getURL('/newtab.html');

const SCOPE_ICONS: Record<Scope, string> = { page: '📄', site: '🌐', newtab: '🗒️' };
const SCOPE_LABELS: Record<Scope, string> = {
    page: 'This page only',
    site: 'Whole site',
    newtab: 'New tab page',
};

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

export function NoteCard({ note }: { note: Note }) {
    const [draft, setDraft] = useState(note.content);
    const [focused, setFocused] = useState(false);
    // Saves must use the newest copy of the note (its scope may have changed in another tab)
    const latest = useRef(note);
    useEffect(() => {
        latest.current = note;
    }, [note]);

    const saveContent = useMemo(
        () =>
            debounce((content: string) => {
                updateNote(latest.current, { content }).catch(console.error);
            }, SAVE_DELAY_MS),
        [],
    );
    useEffect(() => () => saveContent.flush(), [saveContent]);

    // Take edits from elsewhere (e.g. the note on its page), but not while typing here
    useEffect(() => {
        if (!focused) setDraft(note.content);
    }, [note.content, focused]);

    const remove = useConfirm(() => {
        saveContent.cancel();
        deleteNote(latest.current).catch(console.error);
    });

    return (
        <article className="card" data-color={note.color}>
            <header className="card-header">
                <span className="scope" title={SCOPE_LABELS[note.scope]}>
                    {SCOPE_ICONS[note.scope]}
                </span>
                <a
                    className="card-link"
                    href={note.scope === 'newtab' ? NEW_TAB_URL : note.url}
                    target="_blank"
                    rel="noreferrer"
                >
                    {note.scope === 'page' ? note.title || note.url : SCOPE_LABELS[note.scope]}
                </a>
                <button
                    type="button"
                    className={remove.armed ? 'card-delete armed' : 'card-delete'}
                    onClick={remove.onClick}
                    aria-label="Delete note"
                    title="Delete note"
                >
                    {remove.armed ? 'Delete?' : '🗑'}
                </button>
            </header>
            <textarea
                className="card-body"
                value={draft}
                placeholder="(empty note)"
                aria-label="Note text"
                onChange={(e) => {
                    setDraft(e.target.value);
                    saveContent(e.target.value);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                    saveContent.flush();
                    setFocused(false);
                }}
            />
            <footer className="card-footer">Created {formatDate(note.createdAt)}</footer>
        </article>
    );
}
