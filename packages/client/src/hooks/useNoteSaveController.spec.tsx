import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { updateNote } from '~/apis/note.api';
import { getDraftStorageKey, type NoteSaveDraft } from '~/modules/note-draft-storage';
import { queryKeys } from '~/modules/query-key-factory';
import { useNoteSaveController } from './useNoteSaveController';

vi.mock('~/apis/note.api', () => ({
    updateNote: vi.fn(),
}));

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

const createWrapper = (queryClient = createQueryClient()) => {
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
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

    it('resolves conflict state without requiring a pending draft', () => {
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

        act(() => {
            result.current.pauseForConflict('1770000001000');
        });

        expect(result.current.saveStatus).toBe('conflict');

        act(() => {
            result.current.resolveConflict();
        });

        expect(result.current.saveStatus).toBe('saved');
    });

    it('saves queued layout changes with the draft payload', async () => {
        const queryClient = createQueryClient();
        queryClient.setQueryData(queryKeys.notes.detail('7'), {
            title: 'Initial',
            content: 'initial',
            pinned: false,
            layout: 'wide',
            createdAt: '1769999999000',
            updatedAt: '1770000000000',
        });
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
            { wrapper: createWrapper(queryClient) },
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

        expect(queryClient.getQueryData(queryKeys.notes.detail('7'))).toEqual({
            title: 'Draft with layout',
            content: 'content',
            pinned: false,
            layout: 'full',
            createdAt: '1769999999000',
            updatedAt: '1770000001000',
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

    it('returns after an in-flight save flushes the newer queued draft', async () => {
        const firstSave = createDeferred<Awaited<ReturnType<typeof updateNote>>>();
        const secondSave = createDeferred<Awaited<ReturnType<typeof updateNote>>>();
        vi.mocked(updateNote).mockReturnValueOnce(firstSave.promise).mockReturnValueOnce(secondSave.promise);
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

        let flushResult: Awaited<ReturnType<typeof result.current.flushPendingSave>> | undefined;
        const flushPromise = result.current.flushPendingSave().then((result) => {
            flushResult = result;
        });

        await act(async () => {
            firstSave.resolve({
                type: 'success',
                updateNote: {
                    id: '7',
                    title: 'Draft A',
                    updatedAt: '1770000001000',
                },
            } as never);
            await firstSave.promise;
        });

        await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(2));

        await act(async () => {
            secondSave.resolve({
                type: 'success',
                updateNote: {
                    id: '7',
                    title: 'Draft B',
                    updatedAt: '1770000002000',
                },
            } as never);
            await secondSave.promise;
            await flushPromise;
        });

        expect(flushResult).toBe('saved');
        expect(updateNote).toHaveBeenLastCalledWith({
            id: '7',
            title: 'Draft B',
            content: 'content-b',
            editSessionId: 'session-1',
            expectedUpdatedAt: '1770000001000',
        });
    });

    it('keeps the draft recoverable when the save request rejects', async () => {
        const onError = vi.fn();
        vi.mocked(updateNote).mockRejectedValue(new Error('offline'));
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
                    onError,
                }),
            { wrapper: createWrapper() },
        );

        let flushResult: Awaited<ReturnType<typeof result.current.flushPendingSave>> | undefined;

        await act(async () => {
            result.current.queueSave(result.current.buildDraft('Rejected draft'));
            flushResult = await result.current.flushPendingSave();
        });

        const storedDraft = JSON.parse(window.localStorage.getItem(getDraftStorageKey('7')) ?? '{}') as NoteSaveDraft;

        expect(flushResult).toBe('error');
        expect(result.current.saveStatus).toBe('error');
        expect(onError).toHaveBeenCalledWith('Failed to save note.');
        expect(storedDraft.title).toBe('Rejected draft');
    });

    it('ignores a delayed save response after drafts are cleared', async () => {
        const queryClient = createQueryClient();
        const delayedSave = createDeferred<Awaited<ReturnType<typeof updateNote>>>();
        const onSaved = vi.fn();
        const serverVersionRef = { current: '1770000000000' };
        queryClient.setQueryData(queryKeys.notes.detail('7'), {
            title: 'Remote title',
            content: 'remote content',
            pinned: false,
            layout: 'wide',
            createdAt: '1769999999000',
            updatedAt: '1770000002000',
        });
        vi.mocked(updateNote).mockReturnValue(delayedSave.promise);
        const { result } = renderHook(
            () =>
                useNoteSaveController({
                    noteId: '7',
                    initialContent: 'initial',
                    initialUpdatedAt: '1770000000000',
                    editSessionIdRef: { current: 'session-1' },
                    serverVersionRef,
                    getContent: () => 'local content',
                    onSaved,
                    onConflict: vi.fn(),
                    onError: vi.fn(),
                }),
            { wrapper: createWrapper(queryClient) },
        );

        act(() => {
            result.current.queueSave(result.current.buildDraft('Local title'), { immediate: true });
        });
        await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(1));
        act(() => {
            result.current.clearDrafts();
            serverVersionRef.current = '1770000002000';
        });

        await act(async () => {
            delayedSave.resolve({
                type: 'success',
                updateNote: {
                    id: '7',
                    title: 'Local title',
                    updatedAt: '1770000001000',
                },
            } as never);
            await delayedSave.promise;
        });

        expect(onSaved).not.toHaveBeenCalled();
        expect(queryClient.getQueryData(queryKeys.notes.detail('7'))).toMatchObject({
            title: 'Remote title',
            content: 'remote content',
            updatedAt: '1770000002000',
        });
        expect(result.current.saveStatus).toBe('saved');
        expect(serverVersionRef.current).toBe('1770000002000');
        expect(window.localStorage.getItem(getDraftStorageKey('7'))).toBeNull();
    });

    it('runs prerequisite writes before reading the expected note version', async () => {
        const serverVersionRef = { current: '1770000000000' };
        const beforeSave = vi.fn(async () => {
            serverVersionRef.current = '1770000001000';
            return 'saved' as const;
        });
        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: {
                id: '7',
                title: 'Draft title',
                updatedAt: '1770000002000',
            },
        } as never);
        const { result } = renderHook(
            () =>
                useNoteSaveController({
                    noteId: '7',
                    initialContent: 'initial',
                    initialUpdatedAt: '1770000000000',
                    editSessionIdRef: { current: 'session-1' },
                    serverVersionRef,
                    beforeSave,
                    getContent: () => 'content',
                    onSaved: vi.fn(),
                    onConflict: vi.fn(),
                    onError: vi.fn(),
                }),
            { wrapper: createWrapper() },
        );

        await act(async () => {
            result.current.queueSave(result.current.buildDraft('Draft title'));
            await result.current.flushPendingSave();
        });

        expect(beforeSave).toHaveBeenCalledOnce();
        expect(updateNote).toHaveBeenCalledWith({
            id: '7',
            title: 'Draft title',
            content: 'content',
            editSessionId: 'session-1',
            expectedUpdatedAt: '1770000001000',
        });
    });
});
