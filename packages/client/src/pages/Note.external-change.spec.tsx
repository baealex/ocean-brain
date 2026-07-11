import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, Suspense } from 'react';
import { createNote as createNoteApi, fetchNote, fetchNotePropertyKeys, updateNote } from '~/apis/note.api';
import { ToastProvider } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { getDraftStorageKey, type NoteSaveDraft } from '~/modules/note-draft-storage';
import { queryKeys } from '~/modules/query-key-factory';
import { publishServerEvent } from '~/modules/server-events';
import { createTestQueryClient } from '~/test/test-utils';
import { NoteContent } from './Note';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseBlocker = vi.hoisted(() => vi.fn());
const mockUseNoteMutate = vi.hoisted(() => ({
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onPinned: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    getRouteApi: () => ({
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: '1' }),
    }),
    Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <a href="/" {...props}>
            {children}
        </a>
    ),
    useBlocker: mockUseBlocker,
}));

vi.mock('~/apis/note.api', () => ({
    createNote: vi.fn(),
    fetchNote: vi.fn(),
    fetchNotePropertyKeys: vi.fn(),
    updateNote: vi.fn(),
    updateNoteProperties: vi.fn(),
    fetchNoteSnapshot: vi.fn(),
    fetchNoteSnapshots: vi.fn(),
    restoreNoteSnapshot: vi.fn(),
}));

vi.mock('~/components/entities', () => ({
    BackReferences: ({ render }: { render: (backReferences: unknown[]) => React.ReactNode }) => <>{render([])}</>,
}));

vi.mock('~/components/reminder', () => ({
    ReminderPanel: () => null,
}));

vi.mock('~/components/shared/Editor', async () => {
    const React = await import('react');

    const MockEditor = React.forwardRef<
        {
            getContent: () => string;
            getMarkdown: () => string;
            getHtml: () => string;
        },
        {
            content: string;
            onChange: () => void;
        }
    >(({ content, onChange }, ref) => {
        const [value, setValue] = React.useState(content);
        const contentRef = React.useRef(content);

        React.useEffect(() => {
            setValue(content);
            contentRef.current = content;
        }, [content]);

        React.useImperativeHandle(ref, () => ({
            getContent: () => contentRef.current,
            getMarkdown: () => contentRef.current,
            getHtml: () => contentRef.current,
        }));

        return (
            <textarea
                aria-label="Editor"
                value={value}
                onChange={(event) => {
                    const nextContent = event.target.value;

                    setValue(nextContent);
                    contentRef.current = nextContent;
                    onChange();
                }}
            />
        );
    });

    MockEditor.displayName = 'MockEditor';

    return { default: MockEditor };
});

vi.mock('~/hooks/resource/useNoteMutate', () => ({
    default: () => ({
        ...mockUseNoteMutate,
        deleteWarningDialog: null,
    }),
}));

const createContent = (text: string) =>
    JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text, styles: {} }],
            children: [],
        },
    ]);

const createNote = (overrides: Partial<Note> = {}): Note => ({
    id: '1',
    title: 'Initial title',
    content: createContent('Initial body'),
    pinned: false,
    layout: 'wide',
    createdAt: '1779700000000',
    updatedAt: '1779700000000',
    tags: [],
    properties: [],
    ...overrides,
});

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
};

const renderNote = (note: Note) => {
    const queryClient = createTestQueryClient();

    vi.mocked(fetchNote).mockResolvedValue({
        type: 'success',
        note,
    });
    vi.mocked(fetchNotePropertyKeys).mockResolvedValue({
        type: 'success',
        notePropertyKeys: {
            keys: [],
            totalCount: 0,
        },
    });

    render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <StrictMode>
                    <Suspense fallback={<div>Loading</div>}>
                        <NoteContent id={note.id} />
                    </Suspense>
                </StrictMode>
            </ToastProvider>
        </QueryClientProvider>,
    );

    return queryClient;
};

describe('<NoteContent /> external change handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockClear();
        mockUseNoteMutate.onCreate.mockReset();
        mockUseNoteMutate.onDelete.mockReset();
        mockUseNoteMutate.onPinned.mockReset();
        mockUseBlocker.mockReset();
        window.localStorage.clear();
    });

    it('does not reopen the external-change modal when a stale detail refetch resolves after a local save', async () => {
        const initialNote = createNote({
            title: 'Accepted remote title',
            updatedAt: '1779700002000',
        });
        const queryClient = renderNote(initialNote);

        expect(await screen.findByPlaceholderText('Title')).toHaveValue('Accepted remote title');

        const staleRefetch = createDeferred<Awaited<ReturnType<typeof fetchNote>>>();
        vi.mocked(fetchNote).mockReturnValueOnce(staleRefetch.promise);

        void queryClient.refetchQueries({
            queryKey: queryKeys.notes.detail(initialNote.id),
            exact: true,
        });

        await waitFor(() => expect(fetchNote).toHaveBeenCalledTimes(2));

        const savedNote = createNote({
            title: 'Local title',
            updatedAt: '1779700003000',
        });
        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: savedNote,
        });

        const titleInput = screen.getByPlaceholderText('Title');
        fireEvent.change(titleInput, { target: { value: 'Local title' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(1));

        await act(async () => {
            staleRefetch.resolve({
                type: 'success',
                note: initialNote,
            });
            await staleRefetch.promise;
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('Title')).toHaveValue('Local title');
    });

    it('ignores an older note value after reloading latest and saving a newer local edit', async () => {
        const remoteNote = createNote({
            title: 'Remote title',
            updatedAt: '1779700002000',
        });
        const savedNote = createNote({
            title: 'Local title',
            updatedAt: '1779700003000',
        });
        const queryClient = renderNote(remoteNote);

        expect(await screen.findByPlaceholderText('Title')).toHaveValue('Remote title');

        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: savedNote,
        });

        const titleInput = screen.getByPlaceholderText('Title');
        fireEvent.change(titleInput, { target: { value: 'Local title' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(1));

        act(() => {
            queryClient.setQueryData(queryKeys.notes.detail(remoteNote.id), remoteNote);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('Title')).toHaveValue('Local title');
    });

    it('does not block editing once an external update is already loaded', async () => {
        const initialNote = createNote({
            title: 'Initial title',
            updatedAt: '1779700001000',
        });
        const remoteNote = createNote({
            title: 'Remote title',
            updatedAt: '1779700002000',
        });
        const savedNote = createNote({
            title: 'Local title',
            updatedAt: '1779700003000',
        });
        const queryClient = renderNote(initialNote);

        expect(await screen.findByPlaceholderText('Title')).toHaveValue('Initial title');

        act(() => {
            publishServerEvent({
                type: 'web.note.updated',
                source: 'web',
                noteId: initialNote.id,
                updatedAt: remoteNote.updatedAt,
                editSessionId: 'other-editor',
                eventId: 'external-loaded-test',
            });
        });

        expect(await screen.findByRole('dialog', { name: 'This note changed in another tab' })).toBeInTheDocument();

        act(() => {
            queryClient.setQueryData(queryKeys.notes.detail(initialNote.id), remoteNote);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('Title')).toHaveValue('Remote title');

        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: savedNote,
        });

        const titleInput = screen.getByPlaceholderText('Title');
        fireEvent.change(titleInput, { target: { value: 'Local title' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Title')).toHaveValue('Local title');
    });

    it('shows MCP as the source for MCP note updates', async () => {
        const initialNote = createNote({
            title: 'Initial title',
            updatedAt: '1779700001000',
        });

        renderNote(initialNote);

        expect(await screen.findByPlaceholderText('Title')).toHaveValue('Initial title');

        act(() => {
            publishServerEvent({
                type: 'mcp.note.updated',
                source: 'mcp',
                noteId: initialNote.id,
                updatedAt: '1779700002000',
            });
        });

        expect(await screen.findByRole('dialog', { name: 'This note changed through MCP' })).toBeInTheDocument();
        expect(screen.getByText(/An MCP client changed this note while it was open here/)).toBeInTheDocument();
    });

    it('keeps local editor content after saving local content edits', async () => {
        const initialNote = createNote({
            content: createContent('Initial body'),
            updatedAt: '1779700001000',
        });
        const savedNote = createNote({
            content: 'Local body',
            updatedAt: '1779700002000',
        });

        renderNote(initialNote);

        const editor = await screen.findByLabelText('Editor');

        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: savedNote,
        });

        fireEvent.change(editor, { target: { value: 'Local body' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(1));
        expect(screen.getByLabelText('Editor')).toHaveValue('Local body');
    });

    it('flushes pending changes before allowing in-app navigation', async () => {
        const initialNote = createNote({
            title: 'Initial title',
            content: createContent('Initial body'),
            updatedAt: '1779700001000',
        });
        const savedNote = createNote({
            title: 'Route-safe title',
            updatedAt: '1779700002000',
        });

        renderNote(initialNote);

        const titleInput = await screen.findByPlaceholderText('Title');
        fireEvent.change(titleInput, { target: { value: 'Route-safe title' } });

        expect(screen.getByRole('status')).toHaveTextContent('Saving...');

        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: savedNote,
        });

        const blockerOptions = mockUseBlocker.mock.calls.at(-1)?.[0] as
            | { disabled: boolean; shouldBlockFn: () => Promise<boolean> }
            | undefined;

        expect(blockerOptions?.disabled).toBe(false);

        let shouldBlock = true;

        await act(async () => {
            shouldBlock = (await blockerOptions?.shouldBlockFn()) ?? true;
        });

        expect(shouldBlock).toBe(false);
        expect(updateNote).toHaveBeenCalledWith({
            id: initialNote.id,
            title: 'Route-safe title',
            content: initialNote.content,
            editSessionId: expect.any(String),
            expectedUpdatedAt: initialNote.updatedAt,
        });
    });

    it('blocks in-app navigation when the pending save fails', async () => {
        const initialNote = createNote({
            title: 'Initial title',
            updatedAt: '1779700001000',
        });

        renderNote(initialNote);

        const titleInput = await screen.findByPlaceholderText('Title');
        fireEvent.change(titleInput, { target: { value: 'Unsaved title' } });

        vi.mocked(updateNote).mockResolvedValue({
            type: 'error',
            category: 'network',
            errors: [
                {
                    code: 'NETWORK_ERROR',
                    message: 'Network request failed',
                },
            ],
        });

        const blockerOptions = mockUseBlocker.mock.calls.at(-1)?.[0] as
            | { disabled: boolean; shouldBlockFn: () => Promise<boolean> }
            | undefined;

        let shouldBlock = false;

        await act(async () => {
            shouldBlock = (await blockerOptions?.shouldBlockFn()) ?? false;
        });

        expect(shouldBlock).toBe(true);
        expect(await screen.findByText('Save failed. Try again.')).toBeInTheDocument();
    });

    it('shows recovery actions after a save failure and retries the local draft', async () => {
        const initialNote = createNote({
            title: 'Initial title',
            updatedAt: '1779700001000',
        });
        const savedNote = createNote({
            title: 'Recovered title',
            updatedAt: String(Date.now()),
        });

        vi.mocked(updateNote)
            .mockResolvedValueOnce({
                type: 'error',
                category: 'network',
                errors: [
                    {
                        code: 'NETWORK_ERROR',
                        message: 'Network request failed',
                    },
                ],
            })
            .mockResolvedValueOnce({
                type: 'success',
                updateNote: savedNote,
            });

        renderNote(initialNote);

        const titleInput = await screen.findByPlaceholderText('Title');
        fireEvent.change(titleInput, { target: { value: 'Recovered title' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText(/Save failed. Your latest draft is still available here/)).toBeInTheDocument();

        const storedDraft = JSON.parse(
            window.localStorage.getItem(getDraftStorageKey(initialNote.id)) ?? '{}',
        ) as NoteSaveDraft;

        expect(storedDraft.title).toBe('Recovered title');

        fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));

        await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(2));
        await waitFor(() => {
            expect(
                screen.queryByText(/Save failed. Your latest draft is still available here/),
            ).not.toBeInTheDocument();
        });
        expect(window.localStorage.getItem(getDraftStorageKey(initialNote.id))).toBeNull();
        expect(screen.getByRole('status')).toHaveTextContent('Saved just now');
    });

    it('saves a failed draft as a new note without retrying the failed original save', async () => {
        const initialNote = createNote({
            title: 'Initial title',
            content: createContent('Initial body'),
            updatedAt: '1779700001000',
        });

        vi.mocked(updateNote).mockResolvedValue({
            type: 'error',
            category: 'network',
            errors: [
                {
                    code: 'NETWORK_ERROR',
                    message: 'Network request failed',
                },
            ],
        });
        vi.mocked(createNoteApi).mockResolvedValue({
            type: 'success',
            createNote: {
                id: 'new-note-id',
            },
        });

        renderNote(initialNote);

        const titleInput = await screen.findByPlaceholderText('Title');
        fireEvent.change(titleInput, { target: { value: 'Recovered title' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText(/Save failed. Your latest draft is still available here/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Save as new note' }));

        expect(createNoteApi).toHaveBeenCalledWith({
            title: 'Recovered title',
            content: initialNote.content,
            layout: 'wide',
        });
        expect(updateNote).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(window.localStorage.getItem(getDraftStorageKey(initialNote.id))).toBeNull();
        });
        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/$id',
            params: { id: 'new-note-id' },
        });
    });

    it('restores a saved browser draft into the editor', async () => {
        const initialNote = createNote({
            title: 'Initial title',
            content: createContent('Initial body'),
            updatedAt: '1779700001000',
        });
        const localDraft: NoteSaveDraft = {
            title: 'Browser draft title',
            content: 'Browser draft body',
            createdAt: 1779700002000,
            baseUpdatedAt: initialNote.updatedAt,
        };

        vi.mocked(updateNote).mockResolvedValue({
            type: 'success',
            updateNote: createNote({
                title: localDraft.title,
                updatedAt: '1779700003000',
            }),
        });

        window.localStorage.setItem(getDraftStorageKey(initialNote.id), JSON.stringify(localDraft));

        renderNote(initialNote);

        expect(await screen.findByText(/A draft from/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Restore draft' }));

        expect(screen.getByPlaceholderText('Title')).toHaveValue('Browser draft title');
        expect(screen.getByLabelText('Editor')).toHaveValue('Browser draft body');
    });
});
