import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { createNote, deleteNote, fetchBackReferences, pinNote } from '~/apis/note.api';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';
import { createQueryClientWrapper, createTestQueryClient } from '~/test/test-utils';

import useNoteMutate from './useNoteMutate';

const mockNavigate = vi.fn();
const mockConfirm = vi.fn();
const mockToast = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
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

vi.mock('~/components/ui', async () => {
    const actual = await vi.importActual<typeof import('~/components/ui')>('~/components/ui');

    return {
        ...actual,
        useConfirm: () => mockConfirm,
        useToast: () => mockToast,
    };
});

vi.mock('~/apis/note.api', () => ({
    createNote: vi.fn(),
    deleteNote: vi.fn(),
    fetchBackReferences: vi.fn(),
    pinNote: vi.fn(),
}));

function DeleteHarness({ callback }: { callback?: () => void }) {
    const { onDelete, deleteWarningDialog } = useNoteMutate();

    return (
        <>
            <button type="button" onClick={() => void onDelete('note-1', callback)}>
                Trigger delete
            </button>
            {deleteWarningDialog}
        </>
    );
}

const renderDeleteHarness = (callback?: () => void) => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    render(
        <QueryClientProvider client={queryClient}>
            <DeleteHarness callback={callback} />
        </QueryClientProvider>,
    );

    return { invalidateSpy };
};

describe('useNoteMutate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('navigates to the created note on successful create', async () => {
        vi.mocked(createNote).mockResolvedValue({
            type: 'success',
            createNote: { id: 'note-1' },
        } as never);

        const queryClient = createTestQueryClient();
        const { Wrapper } = createQueryClientWrapper(queryClient);
        const { result } = renderHook(() => useNoteMutate(), { wrapper: Wrapper });

        await act(async () => {
            await result.current.onCreate('Title', 'Content');
        });

        expect(createNote).toHaveBeenCalledWith({
            title: 'Title',
            content: 'Content',
        });
        expect(mockNavigate).toHaveBeenCalledWith({
            to: NOTE_ROUTE,
            params: { id: 'note-1' },
        });
    });

    it('invalidates note query groups after pinning', async () => {
        vi.mocked(pinNote).mockResolvedValue({ type: 'success' } as never);

        const queryClient = createTestQueryClient();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
        const callback = vi.fn();
        const { Wrapper } = createQueryClientWrapper(queryClient);
        const { result } = renderHook(() => useNoteMutate(), { wrapper: Wrapper });

        await act(async () => {
            await result.current.onPinned('note-1', false, callback);
        });

        await waitFor(() => {
            expect(pinNote).toHaveBeenCalledWith('note-1', true);
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.listAll(),
                exact: false,
            });
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.tagListAll(),
                exact: false,
            });
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.pinned(),
                exact: true,
            });
        });

        expect(callback).toHaveBeenCalled();
    });

    it('skips deletion when confirm returns false and there are no back references', async () => {
        mockConfirm.mockResolvedValue(false);
        vi.mocked(fetchBackReferences).mockResolvedValue({
            type: 'success',
            backReferences: [],
        } as never);

        const queryClient = createTestQueryClient();
        const { Wrapper } = createQueryClientWrapper(queryClient);
        const { result } = renderHook(() => useNoteMutate(), { wrapper: Wrapper });

        await act(async () => {
            await result.current.onDelete('note-1');
        });

        expect(fetchBackReferences).toHaveBeenCalledWith('note-1');
        expect(mockConfirm).toHaveBeenCalledWith('Move this note to trash?');
        expect(deleteNote).not.toHaveBeenCalled();
    });

    it('moves the note to trash and invalidates related caches after delete when there are no back references', async () => {
        mockConfirm.mockResolvedValue(true);
        vi.mocked(fetchBackReferences).mockResolvedValue({
            type: 'success',
            backReferences: [],
        } as never);
        vi.mocked(deleteNote).mockResolvedValue({
            type: 'success',
            deleteNote: true,
        } as never);

        const queryClient = createTestQueryClient();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
        const callback = vi.fn();
        const { Wrapper } = createQueryClientWrapper(queryClient);
        const { result } = renderHook(() => useNoteMutate(), { wrapper: Wrapper });

        await act(async () => {
            await result.current.onDelete('note-1', callback);
        });

        await waitFor(() => {
            expect(deleteNote).toHaveBeenCalledWith('note-1');
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.all(),
                exact: false,
            });
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.tags.all(),
                exact: false,
            });
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.reminders.all(),
                exact: false,
            });
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.images.all(),
                exact: false,
            });
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ['calendar'],
                exact: false,
            });
        });

        expect(mockToast).toHaveBeenCalledWith('The note has been moved to trash.');
        expect(callback).toHaveBeenCalled();
    });

    it('shows a linked-note warning modal before moving a referenced note to trash', async () => {
        vi.mocked(fetchBackReferences).mockResolvedValue({
            type: 'success',
            backReferences: [
                {
                    id: 'linked-note-1',
                    title: 'Linked note',
                },
            ],
        } as never);
        vi.mocked(deleteNote).mockResolvedValue({
            type: 'success',
            deleteNote: true,
        } as never);

        const callback = vi.fn();
        const { invalidateSpy } = renderDeleteHarness(callback);

        await userEvent.click(screen.getByRole('button', { name: 'Trigger delete' }));

        expect(mockConfirm).not.toHaveBeenCalled();
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Move note to Trash?')).toBeInTheDocument();
        expect(
            within(dialog).getByText(
                /Those links may stop opening while this note stays in Trash\. If you restore this note later, the links will work again\./i,
            ),
        ).toBeInTheDocument();
        expect(within(dialog).getByText('Linked note')).toBeInTheDocument();
        expect(within(dialog).getByRole('link', { name: /open note/i })).toBeInTheDocument();

        await userEvent.click(within(dialog).getByRole('button', { name: /move to trash/i }));

        await waitFor(() => {
            expect(deleteNote).toHaveBeenCalledWith('note-1');
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.all(),
                exact: false,
            });
        });

        expect(mockToast).toHaveBeenCalledWith('The note has been moved to trash.');
        expect(callback).toHaveBeenCalled();
    });

    it('blocks deletion when linked notes cannot be checked', async () => {
        vi.mocked(fetchBackReferences).mockResolvedValue({
            type: 'error',
            category: 'network',
            errors: [
                {
                    code: 'NETWORK_ERROR',
                    message: 'Network request failed',
                },
            ],
        } as never);

        renderDeleteHarness();

        await userEvent.click(screen.getByRole('button', { name: 'Trigger delete' }));

        expect(mockConfirm).not.toHaveBeenCalled();
        expect(deleteNote).not.toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith('Failed to check linked notes before moving this note to Trash.');
    });
});
