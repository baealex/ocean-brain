import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import {
    fetchBackReferences,
    fetchTrashedNote,
    fetchTrashedNotes,
    purgeTrashedNote,
    restoreTrashedNote,
} from '~/apis/note.api';
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
    Link: ({
        children,
        to,
        params: _params,
        ...props
    }: {
        children: ReactNode;
        to?: string;
        params?: unknown;
        [key: string]: unknown;
    }) => (
        <a href={typeof to === 'string' ? to : '#'} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('~/apis/note.api', () => ({
    fetchBackReferences: vi.fn(),
    fetchTrashedNote: vi.fn(),
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
    contentPreview: 'This is a deleted body preview.',
    pinned: false,
    order: 0,
    layout: 'wide' as const,
    tagNames: ['trash'],
};

const anotherTrashedNote = {
    id: '8',
    title: 'Archived draft',
    createdAt: '2026-03-05T00:00:00.000Z',
    updatedAt: '2026-03-11T12:00:00.000Z',
    deletedAt: '2026-04-01T01:00:00.000Z',
    contentPreview: 'Second deleted body preview.',
    pinned: false,
    order: 1,
    layout: 'wide' as const,
    tagNames: ['archive'],
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
        vi.mocked(fetchTrashedNote).mockResolvedValue({
            type: 'success',
            trashedNote: {
                ...trashedNote,
                contentAsMarkdown: 'Full deleted body\n\nSecond line',
            },
        } as never);
        vi.mocked(fetchBackReferences).mockResolvedValue({
            type: 'success',
            backReferences: [],
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

    it('shows a readable preview for trashed note content', async () => {
        renderPage();

        expect(await screen.findByText('This is a deleted body preview.')).toBeInTheDocument();
    });

    it('opens a modal with the full trashed note body', async () => {
        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: /view content/i }));

        await waitFor(() => {
            expect(fetchTrashedNote).toHaveBeenCalledWith('7');
        });
        expect(await screen.findByText(/Full deleted body/)).toBeInTheDocument();
        expect(screen.getByText(/Second line/)).toBeInTheDocument();
    });

    it('permanently deletes a trashed note after basic confirmation when there are no back references', async () => {
        vi.mocked(purgeTrashedNote).mockResolvedValue({
            type: 'success',
            purgeTrashedNote: true,
        } as never);

        const { invalidateSpy } = renderPage();

        await userEvent.click(await screen.findByRole('button', { name: /delete now/i }));
        expect(fetchBackReferences).toHaveBeenCalledWith('7');
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

    it('shows a permanent warning modal when the trashed note is still referenced', async () => {
        vi.mocked(fetchBackReferences).mockResolvedValue({
            type: 'success',
            backReferences: [
                {
                    id: 'linked-note-1',
                    title: 'Linked note',
                },
            ],
        } as never);
        vi.mocked(purgeTrashedNote).mockResolvedValue({
            type: 'success',
            purgeTrashedNote: true,
        } as never);

        const { invalidateSpy } = renderPage();

        await userEvent.click(await screen.findByRole('button', { name: /delete now/i }));

        expect(purgeTrashedNote).not.toHaveBeenCalled();
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Permanently delete note?')).toBeInTheDocument();
        expect(
            within(dialog).getByText(
                /If you permanently delete it, those links will stay broken\. Other notes will not be edited automatically\./i,
            ),
        ).toBeInTheDocument();
        expect(within(dialog).getByText('Linked note')).toBeInTheDocument();
        expect(within(dialog).getByRole('link', { name: /open note/i })).toBeInTheDocument();

        await userEvent.click(within(dialog).getByRole('button', { name: /delete now/i }));

        await waitFor(() => {
            expect(vi.mocked(purgeTrashedNote).mock.calls[0]?.[0]).toBe('7');
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.trashAll(),
                exact: false,
            });
        });
    });

    it('bulk deletes selected trashed notes after confirmation', async () => {
        vi.mocked(fetchTrashedNotes).mockResolvedValue({
            type: 'success',
            trashedNotes: {
                totalCount: 2,
                notes: [trashedNote, anotherTrashedNote],
            },
        } as never);
        vi.mocked(purgeTrashedNote).mockResolvedValue({
            type: 'success',
            purgeTrashedNote: true,
        } as never);

        const { invalidateSpy } = renderPage();

        await userEvent.click(await screen.findByRole('checkbox', { name: /select disposable note/i }));
        await userEvent.click(screen.getByRole('checkbox', { name: /select archived draft/i }));
        expect(screen.getByText('Selected 2 notes')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /delete selected/i }));

        await waitFor(() => {
            expect(fetchBackReferences).toHaveBeenCalledWith('7');
            expect(fetchBackReferences).toHaveBeenCalledWith('8');
        });

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Permanently delete selected notes?')).toBeInTheDocument();
        expect(within(dialog).getByText('Disposable note')).toBeInTheDocument();
        expect(within(dialog).getByText('Archived draft')).toBeInTheDocument();

        await userEvent.click(within(dialog).getByRole('button', { name: /delete selected/i }));

        await waitFor(() => {
            expect(purgeTrashedNote).toHaveBeenCalledTimes(2);
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.trashAll(),
                exact: false,
            });
        });
    });

    it('shows referenced note counts in the bulk delete modal', async () => {
        vi.mocked(fetchTrashedNotes).mockResolvedValue({
            type: 'success',
            trashedNotes: {
                totalCount: 2,
                notes: [trashedNote, anotherTrashedNote],
            },
        } as never);
        vi.mocked(fetchBackReferences).mockImplementation(async (id: string) => {
            if (id === '7') {
                return {
                    type: 'success',
                    backReferences: [
                        {
                            id: 'linked-note-1',
                            title: 'Linked note',
                        },
                    ],
                } as never;
            }

            return {
                type: 'success',
                backReferences: [],
            } as never;
        });

        renderPage();

        await userEvent.click(await screen.findByRole('checkbox', { name: /select disposable note/i }));
        await userEvent.click(screen.getByRole('checkbox', { name: /select archived draft/i }));
        await userEvent.click(screen.getByRole('button', { name: /delete selected/i }));

        const dialog = await screen.findByRole('dialog');
        expect(
            within(dialog).getByText(
                /1 note is still referenced by other notes, so those links will stay broken\. Other notes will not be edited automatically\./i,
            ),
        ).toBeInTheDocument();
        expect(within(dialog).getByText('Referenced by 1 note')).toBeInTheDocument();
    });
});
