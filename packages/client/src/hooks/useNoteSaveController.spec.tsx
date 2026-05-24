import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { updateNote } from '~/apis/note.api';
import { getDraftStorageKey, type NoteSaveDraft } from '~/modules/note-draft-storage';
import { useNoteSaveController } from './useNoteSaveController';

vi.mock('~/apis/note.api', () => ({
    updateNote: vi.fn(),
}));

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('useNoteSaveController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    it('preserves a newer queued draft when an older in-flight save fails', async () => {
        let resolveUpdate: (value: Awaited<ReturnType<typeof updateNote>>) => void = () => undefined;
        vi.mocked(updateNote).mockReturnValue(
            new Promise((resolve) => {
                resolveUpdate = resolve;
            }),
        );
        let content = 'content-a';
        const { result } = renderHook(
            () =>
                useNoteSaveController({
                    noteId: '7',
                    initialContent: 'initial',
                    initialUpdatedAt: '1770000000000',
                    editSessionIdRef: { current: 'session-1' },
                    getContent: () => content,
                    onSaved: vi.fn(),
                    onConflict: vi.fn(),
                    onError: vi.fn(),
                }),
            { wrapper: createWrapper() },
        );

        await act(async () => {
            result.current.queueSave(result.current.buildDraft('Draft A'), { immediate: true });
        });

        act(() => {
            content = 'content-b';
            result.current.queueSave(result.current.buildDraft('Draft B'));
        });

        await act(async () => {
            resolveUpdate({
                type: 'error',
                category: 'graphql',
                errors: [
                    {
                        code: 'GRAPHQL_ERROR',
                        message: 'Save failed',
                    },
                ],
            });
            await Promise.resolve();
        });

        const storedDraft = JSON.parse(window.localStorage.getItem(getDraftStorageKey('7')) ?? '{}') as NoteSaveDraft;

        expect(storedDraft.title).toBe('Draft B');
        expect(storedDraft.content).toBe('content-b');

        act(() => {
            result.current.clearDrafts();
        });
    });

    it('restores stale local drafts into conflict state without auto-saving', async () => {
        const staleDraft: NoteSaveDraft = {
            title: 'Stale draft',
            content: 'stale content',
            createdAt: 1770000000000,
            baseUpdatedAt: '1769999999999',
        };
        const onConflict = vi.fn();
        window.localStorage.setItem(getDraftStorageKey('7'), JSON.stringify(staleDraft));

        const { result } = renderHook(
            () =>
                useNoteSaveController({
                    noteId: '7',
                    initialContent: 'initial',
                    initialUpdatedAt: '1770000000000',
                    editSessionIdRef: { current: 'session-1' },
                    getContent: () => 'current content',
                    onSaved: vi.fn(),
                    onConflict,
                    onError: vi.fn(),
                }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => expect(result.current.localDraft).not.toBeNull());

        act(() => {
            result.current.restoreLocalDraft(staleDraft);
        });

        expect(result.current.saveStatus).toBe('conflict');
        expect(onConflict).toHaveBeenCalledWith('1770000000000');
        expect(updateNote).not.toHaveBeenCalled();

        act(() => {
            result.current.clearDrafts();
        });
    });

    it('saves queued layout changes with the draft payload', async () => {
        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: {
                id: '7',
                title: 'Draft with layout',
                updatedAt: '1770000001000',
            },
        } as never);

        const { result } = renderHook(
            () =>
                useNoteSaveController({
                    noteId: '7',
                    initialContent: 'initial',
                    initialUpdatedAt: '1770000000000',
                    editSessionIdRef: { current: 'session-1' },
                    getContent: () => 'content',
                    onSaved: vi.fn(),
                    onConflict: vi.fn(),
                    onError: vi.fn(),
                }),
            { wrapper: createWrapper() },
        );

        await act(async () => {
            result.current.queueSave(result.current.buildDraft('Draft with layout', { layout: 'full' }), {
                immediate: true,
            });
        });

        await waitFor(() => {
            expect(updateNote).toHaveBeenCalledWith({
                id: '7',
                title: 'Draft with layout',
                content: 'content',
                layout: 'full',
                editSessionId: 'session-1',
                expectedUpdatedAt: '1770000000000',
            });
        });
    });

    it('uses an explicit force flag when overwriting a conflict', async () => {
        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: {
                id: '7',
                title: 'Forced draft',
                updatedAt: '1770000001000',
            },
        } as never);

        const { result } = renderHook(
            () =>
                useNoteSaveController({
                    noteId: '7',
                    initialContent: 'initial',
                    initialUpdatedAt: '1770000000000',
                    editSessionIdRef: { current: 'session-1' },
                    getContent: () => 'content',
                    onSaved: vi.fn(),
                    onConflict: vi.fn(),
                    onError: vi.fn(),
                }),
            { wrapper: createWrapper() },
        );

        await act(async () => {
            result.current.queueSave(result.current.buildDraft('Forced draft'));
            await result.current.flushPendingSave({ ignoreConflict: true });
        });

        await waitFor(() => {
            expect(updateNote).toHaveBeenCalledWith({
                id: '7',
                title: 'Forced draft',
                content: 'content',
                editSessionId: 'session-1',
                force: true,
            });
        });
    });

    it('does not rebase a pending draft when fresh server data arrives', () => {
        const { result, rerender } = renderHook(
            ({ initialUpdatedAt }: { initialUpdatedAt: string }) =>
                useNoteSaveController({
                    noteId: '7',
                    initialContent: 'initial',
                    initialUpdatedAt,
                    editSessionIdRef: { current: 'session-1' },
                    getContent: () => 'content',
                    onSaved: vi.fn(),
                    onConflict: vi.fn(),
                    onError: vi.fn(),
                }),
            {
                initialProps: {
                    initialUpdatedAt: '1770000000000',
                },
                wrapper: createWrapper(),
            },
        );

        act(() => {
            result.current.queueSave(result.current.buildDraft('Pending draft'));
        });

        rerender({
            initialUpdatedAt: '1770000001000',
        });

        expect(result.current.buildDraft('Next draft').baseUpdatedAt).toBe('1770000000000');
    });
});
