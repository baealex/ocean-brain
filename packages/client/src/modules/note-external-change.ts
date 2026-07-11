import type { ServerEvent } from '~/modules/server-events';
import { compareNoteVersions } from './note-version';

export type ExternalNoteChangeSource = 'web' | 'mcp' | 'unknown';

export type ExternalNoteChange =
    | { type: 'updated'; updatedAt: string; source: ExternalNoteChangeSource }
    | { type: 'deleted'; source: ExternalNoteChangeSource };

interface ClassifyExternalNoteEventInput {
    event: ServerEvent;
    noteId: string;
    editSessionId: string;
    loadedUpdatedAt: string;
    acceptedUpdatedAt: string;
    hasUnsavedChanges: boolean;
}

export type ExternalNoteEventDecision =
    | { type: 'ignore' }
    | { type: 'notify'; change: ExternalNoteChange; shouldPauseSave: boolean };

export const classifyExternalNoteEvent = ({
    event,
    noteId,
    editSessionId,
    loadedUpdatedAt,
    acceptedUpdatedAt,
    hasUnsavedChanges,
}: ClassifyExternalNoteEventInput): ExternalNoteEventDecision => {
    if (event.noteId !== noteId || event.type === 'mcp.note.created') {
        return { type: 'ignore' };
    }

    if (event.source === 'web' && event.editSessionId === editSessionId) {
        return { type: 'ignore' };
    }

    if (event.type === 'mcp.note.deleted') {
        return {
            type: 'notify',
            change: { type: 'deleted', source: event.source },
            shouldPauseSave: false,
        };
    }

    const comparedWithLoaded = compareNoteVersions(event.updatedAt, loadedUpdatedAt);
    const comparedWithAccepted = compareNoteVersions(event.updatedAt, acceptedUpdatedAt);

    if (
        (comparedWithLoaded !== null && comparedWithLoaded <= 0) ||
        (comparedWithAccepted !== null && comparedWithAccepted <= 0)
    ) {
        return { type: 'ignore' };
    }

    return {
        type: 'notify',
        change: {
            type: 'updated',
            updatedAt: event.updatedAt,
            source: event.source,
        },
        shouldPauseSave: hasUnsavedChanges,
    };
};

export const isBlockingExternalNoteChange = ({
    change,
    isConflict,
    loadedUpdatedAt,
}: {
    change: ExternalNoteChange | null;
    isConflict: boolean;
    loadedUpdatedAt: string;
}) => {
    if (!change) {
        return false;
    }

    return !(change.type === 'updated' && !isConflict && change.updatedAt === loadedUpdatedAt);
};
