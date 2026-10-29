import '@/page-ui/notes.css';
import './style.css';
import { createNote, getNewTabNotes, onNotesChanged } from '@/core/storage';
import { DEFAULT_WIDTH } from '@/core/types';
import { NoteBoard } from '@/page-ui/NoteBoard';

// Replaces the browser's new tab page (WXT registers this entrypoint as the new tab override).
// Shows the "new tab" notes, which belong to no website, plus a web search box.

const NEW_TAB_TITLE = 'New tab';
const NEW_NOTE_TOP_OFFSET = 24;
const COMMAND_ADD_NOTE = 'add-note';

function element<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

const boardEl = element<HTMLElement>('board');
const emptyEl = element<HTMLElement>('empty');
const searchForm = element<HTMLFormElement>('search');

const board = new NoteBoard(boardEl, {
    getPage: () => ({ url: '', title: NEW_TAB_TITLE }),
});

let loadSeq = 0;
async function reload(): Promise<void> {
    // Saves fire change events quickly; only the newest load may render
    const seq = ++loadSeq;
    const notes = await getNewTabNotes();
    if (seq !== loadSeq) return;
    board.render(notes);
    emptyEl.hidden = notes.length > 0;
}

// x/y are board coordinates; by default the note goes near the top of the visible area
async function addNote(x?: number, y?: number): Promise<void> {
    const note = await createNote({
        scope: 'newtab',
        url: '',
        title: NEW_TAB_TITLE,
        x: Math.round(x ?? Math.max(0, scrollX + innerWidth / 2 - DEFAULT_WIDTH / 2)),
        y: Math.round(y ?? Math.max(0, scrollY - boardEl.offsetTop) + NEW_NOTE_TOP_OFFSET),
    });
    board.focusWhenDrawn(note.id);
    await reload();
}

interface SearchApi {
    query?: (options: { text: string; disposition: string }) => Promise<void>; // Chrome, Edge
    search?: (options: { query: string; disposition: string }) => Promise<void>; // Firefox
}

// Searches with the user's own default search engine
function searchWeb(text: string): Promise<void> {
    const api = browser.search as unknown as SearchApi;
    if (api.query) return api.query({ text, disposition: 'CURRENT_TAB' });
    if (api.search) return api.search({ query: text, disposition: 'CURRENT_TAB' });
    return Promise.reject(new Error('Search is not available in this browser'));
}

function reportError(error: unknown): void {
    console.error('[sticky-notes]', error);
}

element<HTMLButtonElement>('add').addEventListener('click', () => {
    addNote().catch(reportError);
});

element<HTMLAnchorElement>('all-notes').href = browser.runtime.getURL('/dashboard.html');

// Double-click on empty board space puts a note right there
boardEl.addEventListener('dblclick', (e) => {
    if (e.target !== boardEl && e.target !== emptyEl) return;
    addNote(e.pageX - boardEl.offsetLeft - 20, e.pageY - boardEl.offsetTop - 14).catch(reportError);
});

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = new FormData(searchForm).get('q')?.toString().trim();
    if (text) searchWeb(text).catch(reportError);
});

// The keyboard shortcut reaches every extension page; only the tab it was pressed in reacts
browser.tabs
    .getCurrent()
    .then((me) => {
        browser.commands.onCommand.addListener((command, tab) => {
            if (command === COMMAND_ADD_NOTE && tab?.id === me?.id) addNote().catch(reportError);
        });
    })
    .catch(reportError);

window.addEventListener('pagehide', () => board.flushAll());
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') board.flushAll();
});

onNotesChanged(() => void reload());
reload().catch(reportError);
