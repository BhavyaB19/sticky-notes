// 'newtab' notes live on the extension's new tab page and aren't tied to any website
export type Scope = 'page' | 'site' | 'newtab';
export const NEW_TAB_KEY = 'newtab'; // scopeKey of every new tab note
export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
    id: string;
    scope: Scope;
    scopeKey: string; // page key, site key or NEW_TAB_KEY, depending on scope
    url: string; // full URL where it was created ('' for new tab notes)
    title: string; // page title at creation
    content: string;
    color: NoteColor;
    x: number;
    y: number;
    width: number;
    height: number;
    minimized: boolean;
    createdAt: number;
    updatedAt: number;
}

// What a caller passes in to create a note; storage fills in the rest
export type NewNote = Pick<Note, 'scope' | 'url' | 'title'> &
    Partial<Pick<Note, 'content' | 'color' | 'x' | 'y' | 'width' | 'height'>>;

// Scope is changed through changeScope(), since it moves the note to another bucket
export type NoteChanges = Partial<
    Pick<Note, 'content' | 'color' | 'x' | 'y' | 'width' | 'height' | 'minimized'>
>;

export const DEFAULT_COLOR: NoteColor = 'yellow';
export const DEFAULT_WIDTH = 240;
export const DEFAULT_HEIGHT = 200;
