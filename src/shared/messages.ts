import type { Scope } from '@/core/types';

// Sent from the popup or background worker to the content script in a tab
export type ContentMessage =
    | { type: 'add-note'; scope: Scope; atContextMenu?: boolean; content?: string }
    | { type: 'focus-note'; id: string };

// Sent from the content script to the background worker
export type BackgroundMessage = { type: 'notes-count'; count: number };
