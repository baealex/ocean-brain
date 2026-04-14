import { act, renderHook, waitFor } from '@testing-library/react';

import { createNote, deleteNote, pinNote } from '~/apis/note.api';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';
import { createQueryClientWrapper, createTestQueryClient } from '~/test/test-utils';

import useNoteMutate from './useNoteMutate';

const mockNavigate = vi.fn();
const mockConfirm = vi.fn();
const mockToast = vi.fn();

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mockNavigate }));

vi.mock('~/components/ui', () => ({
    useConfirm: () => mockConfirm,
    useToast: () => mockToast,
}));

vi.mock('~/apis/note.api', () => ({
    createNote: vi.fn(),
    deleteNote: vi.fn(),
    pinNote: vi.fn(),
}));

describe('useNoteMutate', () => {
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

    it('skips deletion when confirm returns false', async () => {
        mockConfirm.mockResolvedValue(false);

        const queryClient = createTestQueryClient();
        const { Wrapper } = createQueryClientWrapper(queryClient);
        const { result } = renderHook(() => useNoteMutate(), { wrapper: Wrapper });

        await act(async () => {
            await result.current.onDelete('note-1');
        });

        expect(deleteNote).not.toHaveBeenCalled();
    });

    it('moves the note to trash and invalidates related caches after delete', async () => {
        mockConfirm.mockResolvedValue(true);
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
});
