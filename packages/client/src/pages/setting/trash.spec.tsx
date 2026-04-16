import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchTrashedNotes, purgeTrashedNote, restoreTrashedNote } from '~/apis/note.api';
import { ConfirmProvider, ToastProvider } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { createTestQueryClient } from '~/test/test-utils';
import Trash from './trash';

const { mockNavigate } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    getRouteApi: () => ({
        useSearch: () => ({ page: 1 }),
        useNavigate: () => mockNavigate,
    }),
}));

vi.mock('~/apis/note.api', () => ({
    fetchTrashedNotes: vi.fn(),
    purgeTrashedNote: vi.fn(),
    restoreTrashedNote: vi.fn(),
}));

const trashedNote = {
    id: '7',
    title: 'Disposable note',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-10T12:00:00.000Z',
    deletedAt: '2026-03-31T01:00:00.000Z',
    pinned: false,
    order: 0,
    layout: 'wide' as const,
    tagNames: ['trash'],
};

const renderPage = () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    render(
        <QueryClientProvider client={queryClient}>
            <ConfirmProvider>
                <ToastProvider>
                    <Trash />
                </ToastProvider>
            </ConfirmProvider>
        </QueryClientProvider>,
    );

    return { invalidateSpy };
};

describe('<Trash />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchTrashedNotes).mockResolvedValue({
            type: 'success',
            trashedNotes: {
                totalCount: 1,
                notes: [trashedNote],
            },
        } as never);
        vi.mocked(restoreTrashedNote).mockResolvedValue({
            type: 'success',
            restoreTrashedNote: {
                id: '7',
                title: 'Disposable note',
                updatedAt: '1774915200000',
                layout: 'wide',
                pinned: false,
                content: 'content',
            },
        } as never);
    });

    it('permanently deletes a trashed note after confirmation', async () => {
        vi.mocked(purgeTrashedNote).mockResolvedValue({
            type: 'success',
            purgeTrashedNote: true,
        } as never);

        const { invalidateSpy } = renderPage();

        await userEvent.click(await screen.findByRole('button', { name: /delete now/i }));
        expect(purgeTrashedNote).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: /ok/i }));

        await waitFor(() => {
            expect(vi.mocked(purgeTrashedNote).mock.calls[0]?.[0]).toBe('7');
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.trashAll(),
                exact: false,
            });
        });
    });
});
