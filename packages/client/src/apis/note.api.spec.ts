import { fetchNoteSnapshots, fetchTrashedNote, fetchTrashedNotes, purgeTrashedNote, updateNote } from '~/apis/note.api';
import { graphQuery } from '~/modules/graph-query';

vi.mock('~/modules/graph-query', () => ({ graphQuery: vi.fn() }));

describe('note.api', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends trashed note purge requests through GraphQL variables', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            purgeTrashedNote: true,
        } as never);

        const response = await purgeTrashedNote('7');

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('mutation PurgeTrashedNote'), { id: '7' });
        expect(response).toEqual({
            type: 'success',
            purgeTrashedNote: true,
        });
    });

    it('requests trashed note content previews with pagination variables', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            trashedNotes: {
                totalCount: 0,
                notes: [],
            },
        } as never);

        const response = await fetchTrashedNotes({ limit: 10, offset: 20 });

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('contentPreview'), {
            pagination: {
                limit: 10,
                offset: 20,
            },
        });
        expect(response).toEqual({
            type: 'success',
            trashedNotes: {
                totalCount: 0,
                notes: [],
            },
        });
    });

    it('requests a single trashed note with full markdown content through GraphQL variables', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            trashedNote: {
                id: '7',
                title: 'Deleted note',
                createdAt: '2026-03-01T00:00:00.000Z',
                updatedAt: '2026-03-10T12:00:00.000Z',
                deletedAt: '2026-03-31T01:00:00.000Z',
                contentPreview: 'Preview',
                contentAsMarkdown: 'Full deleted body',
                pinned: false,
                order: 0,
                layout: 'wide',
                tagNames: [],
            },
        } as never);

        const response = await fetchTrashedNote('7');

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('query FetchTrashedNote'), { id: '7' });
        expect(response).toEqual({
            type: 'success',
            trashedNote: {
                id: '7',
                title: 'Deleted note',
                createdAt: '2026-03-01T00:00:00.000Z',
                updatedAt: '2026-03-10T12:00:00.000Z',
                deletedAt: '2026-03-31T01:00:00.000Z',
                contentPreview: 'Preview',
                contentAsMarkdown: 'Full deleted body',
                pinned: false,
                order: 0,
                layout: 'wide',
                tagNames: [],
            },
        });
    });

    it('sends conditional update versions through GraphQL variables', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            updateNote: {
                id: '7',
                title: 'Updated note',
                updatedAt: '1770000000000',
            },
        } as never);

        const response = await updateNote({
            id: '7',
            title: 'Updated note',
            content: '[]',
            editSessionId: 'session-1',
            expectedUpdatedAt: '1769999999999',
        });

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('expectedUpdatedAt'), {
            id: '7',
            note: {
                title: 'Updated note',
                content: '[]',
            },
            editSessionId: 'session-1',
            expectedUpdatedAt: '1769999999999',
        });
        expect(response).toEqual({
            type: 'success',
            updateNote: {
                id: '7',
                title: 'Updated note',
                updatedAt: '1770000000000',
            },
        });
    });

    it('sends explicit force flags through GraphQL variables', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            updateNote: {
                id: '7',
                title: 'Updated note',
                updatedAt: '1770000000000',
            },
        } as never);

        await updateNote({
            id: '7',
            title: 'Updated note',
            force: true,
        });

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('$force: Boolean'), {
            id: '7',
            note: {
                title: 'Updated note',
            },
            force: true,
        });
    });

    it('requests twenty note snapshots by default', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            noteSnapshots: [],
        } as never);

        await fetchNoteSnapshots('7');

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('query FetchNoteSnapshots'), {
            id: '7',
            limit: 20,
        });
    });
});
