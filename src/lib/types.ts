export type Scope = 'page' | 'site';
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

export interface Note {
    id: string;
    scope: Scope;
    scopeKey: string; // page key or site key, depending on scope
    url: string; // full URL where it was created
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
