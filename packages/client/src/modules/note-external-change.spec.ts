import { classifyExternalNoteEvent, isBlockingExternalNoteChange } from './note-external-change';

const baseInput = {
    noteId: '7',
    editSessionId: 'session-1',
    loadedUpdatedAt: '1770000000000',
    acceptedUpdatedAt: '1770000000000',
    hasUnsavedChanges: false,
};

describe('classifyExternalNoteEvent', () => {
    it.each([
        [
            'an event for a different note',
            {
                type: 'mcp.note.updated' as const,
                source: 'mcp' as const,
                noteId: '8',
                updatedAt: '1770000001000',
            },
        ],
        [
            'a note creation event',
            {
                type: 'mcp.note.created' as const,
                source: 'mcp' as const,
                noteId: '7',
                updatedAt: '1770000001000',
            },
        ],
    ])('ignores %s', (_scenario, event) => {
        expect(classifyExternalNoteEvent({ ...baseInput, event })).toEqual({ type: 'ignore' });
    });

    it('ignores a web update published by the current edit session', () => {
        const decision = classifyExternalNoteEvent({
            ...baseInput,
            event: {
                type: 'web.note.updated',
                source: 'web',
                noteId: '7',
                updatedAt: '1770000001000',
                editSessionId: 'session-1',
            },
        });

        expect(decision).toEqual({ type: 'ignore' });
    });

    it('pauses saving when a different editor updates a dirty note', () => {
        const decision = classifyExternalNoteEvent({
            ...baseInput,
            hasUnsavedChanges: true,
            event: {
                type: 'mcp.note.updated',
                source: 'mcp',
                noteId: '7',
                updatedAt: '1770000001000',
            },
        });

        expect(decision).toEqual({
            type: 'notify',
            change: {
                type: 'updated',
                source: 'mcp',
                updatedAt: '1770000001000',
            },
            shouldPauseSave: true,
        });
    });

    it('ignores an update that is already loaded or accepted', () => {
        const event = {
            type: 'web.note.updated' as const,
            source: 'web' as const,
            noteId: '7',
            updatedAt: '1770000001000',
            editSessionId: 'session-2',
        };

        expect(
            classifyExternalNoteEvent({
                ...baseInput,
                loadedUpdatedAt: event.updatedAt,
                event,
            }),
        ).toEqual({ type: 'ignore' });
        expect(
            classifyExternalNoteEvent({
                ...baseInput,
                acceptedUpdatedAt: event.updatedAt,
                event,
            }),
        ).toEqual({ type: 'ignore' });
    });

    it('ignores an out-of-order update older than the loaded version', () => {
        const decision = classifyExternalNoteEvent({
            ...baseInput,
            loadedUpdatedAt: '1770000003000',
            acceptedUpdatedAt: '1770000003000',
            hasUnsavedChanges: true,
            event: {
                type: 'mcp.note.updated',
                source: 'mcp',
                noteId: '7',
                updatedAt: '1770000002000',
            },
        });

        expect(decision).toEqual({ type: 'ignore' });
    });

    it('surfaces deletion independently of local save state', () => {
        const decision = classifyExternalNoteEvent({
            ...baseInput,
            hasUnsavedChanges: true,
            event: {
                type: 'mcp.note.deleted',
                source: 'mcp',
                noteId: '7',
            },
        });

        expect(decision).toEqual({
            type: 'notify',
            change: { type: 'deleted', source: 'mcp' },
            shouldPauseSave: false,
        });
    });
});

describe('isBlockingExternalNoteChange', () => {
    it('stops blocking after a non-conflicting update is loaded', () => {
        expect(
            isBlockingExternalNoteChange({
                change: { type: 'updated', source: 'web', updatedAt: '1770000001000' },
                isConflict: false,
                loadedUpdatedAt: '1770000001000',
            }),
        ).toBe(false);
    });

    it('keeps blocking when the loaded update still conflicts with a draft', () => {
        expect(
            isBlockingExternalNoteChange({
                change: { type: 'updated', source: 'web', updatedAt: '1770000001000' },
                isConflict: true,
                loadedUpdatedAt: '1770000001000',
            }),
        ).toBe(true);
    });
});
