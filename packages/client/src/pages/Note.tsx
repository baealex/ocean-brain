import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import classNames from 'classnames';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNote, updateNote } from '~/apis/note.api';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { BackReferences } from '~/components/entities';
import * as Icon from '~/components/icon';
import { LayoutModal, RestoreSnapshotModal } from '~/components/note';
import { ReminderPanel } from '~/components/reminder';
import {
    AuxiliaryPanelHeader,
    Button,
    Callout,
    Dropdown,
    Modal,
    ModalActionRow,
    PageLayout,
    SelectionOptionCard,
    Skeleton,
} from '~/components/shared';
import type { EditorRef } from '~/components/shared/Editor';
import Editor from '~/components/shared/Editor';
import { Checkbox, MoreButton, Text, useToast } from '~/components/ui';
import useNoteMutate from '~/hooks/resource/useNoteMutate';
import type { NoteLayout } from '~/models/note.model';
import {
    createHtmlExport,
    createMarkdownExport,
    downloadTextFile,
    getNoteExportFilename,
    type HtmlExportMode,
} from '~/modules/note-export';
import { queryKeys } from '~/modules/query-key-factory';
import { subscribeServerEvent } from '~/modules/server-events';
import { NOTE_ROUTE, SETTINGS_TRASH_ROUTE } from '~/modules/url';

const Route = getRouteApi(NOTE_ROUTE);

const formatSavedAt = (updatedAt: string) => dayjs(Number(updatedAt)).format('YYYY-MM-DD HH:mm:ss');

const createEditSessionId = () => nanoid();
const NOTE_AUTOSAVE_DELAY_MS = 1000;
const NOTE_UPDATE_CONFLICT_CODE = 'NOTE_UPDATE_CONFLICT';

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

interface NoteSaveDraft {
    title: string;
    content: string;
    createdAt: number;
}

const getDraftStorageKey = (id: string) => `ocean-brain.note-draft.${id}`;

const readLocalDraft = (id: string): NoteSaveDraft | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const rawDraft = window.localStorage.getItem(getDraftStorageKey(id));

        if (!rawDraft) {
            return null;
        }

        const draft = JSON.parse(rawDraft) as Partial<NoteSaveDraft>;

        if (typeof draft.title !== 'string' || typeof draft.content !== 'string') {
            return null;
        }

        return {
            title: draft.title,
            content: draft.content,
            createdAt: typeof draft.createdAt === 'number' ? draft.createdAt : Date.now(),
        };
    } catch {
        return null;
    }
};

const writeLocalDraft = (id: string, draft: NoteSaveDraft) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(getDraftStorageKey(id), JSON.stringify(draft));
    } catch {
        // Saving to the server remains the source of truth if local recovery storage is unavailable.
    }
};

const clearLocalDraft = (id: string) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.removeItem(getDraftStorageKey(id));
    } catch {
        // Ignore storage failures while clearing optional recovery state.
    }
};

const NOTE_LAYOUT_WIDTH: Record<NoteLayout, string> = {
    narrow: 'max-w-[640px]',
    wide: 'max-w-[896px]',
    full: 'max-w-full px-4',
};

const notePageFallback = (
    <PageLayout title="Loading note" variant="none">
        <main className="mx-auto max-w-[896px]">
            <Skeleton className="mb-8" height="66px" />
            <Skeleton className="ml-12 mb-8" height="150px" />
            <Skeleton className="mb-5" height="80px" />
            <Skeleton height="80px" />
        </main>
    </PageLayout>
);

interface NoteContentProps {
    id: string;
}

type ExternalNoteChange = { type: 'updated'; updatedAt: string } | { type: 'deleted' };

function NoteContent({ id }: NoteContentProps) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const navigate = Route.useNavigate();
    const editorRef = useRef<EditorRef>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const editSessionIdRef = useRef<string>(createEditSessionId());
    const saveTimerRef = useRef<number | null>(null);
    const pendingDraftRef = useRef<NoteSaveDraft | null>(null);
    const inFlightSaveRef = useRef(false);
    const flushAfterInFlightRef = useRef(false);
    const serverUpdatedAtRef = useRef<string>('');
    const isSaveConflictRef = useRef(false);
    const isAliveRef = useRef(true);

    const noteQuery = useSuspenseQuery({
        queryKey: queryKeys.notes.detail(id),
        queryFn: async () => {
            const response = await fetchNote(id);
            if (response.type === 'error') {
                throw response;
            }
            return response.note;
        },
        gcTime: 0,
    });
    const note = noteQuery.data;
    serverUpdatedAtRef.current ||= note.updatedAt;

    const [title, setTitle] = useState(note.title);
    const [lastSavedAt, setLastSavedAt] = useState(() => formatSavedAt(note.updatedAt));
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [isPinned, setIsPinned] = useState(note.pinned);
    const [layout, setLayout] = useState<NoteLayout>(note.layout || 'wide');
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<'markdown' | 'html'>('markdown');
    const [includeMetadata, setIncludeMetadata] = useState(false);
    const [htmlExportMode, setHtmlExportMode] = useState<HtmlExportMode>('fragment');
    const [externalNoteChange, setExternalNoteChange] = useState<ExternalNoteChange | null>(null);
    const [localDraft, setLocalDraft] = useState<NoteSaveDraft | null>(null);
    const [editorContentOverride, setEditorContentOverride] = useState<string | null>(null);
    const [editorRevision, setEditorRevision] = useState(0);

    useEffect(() => {
        return () => {
            isAliveRef.current = false;
        };
    }, []);

    useEffect(() => {
        serverUpdatedAtRef.current = note.updatedAt;
        setIsPinned(note.pinned);
        setLayout(note.layout || 'wide');

        if (!pendingDraftRef.current && !inFlightSaveRef.current && !isSaveConflictRef.current) {
            setTitle(note.title);
            setLastSavedAt(formatSavedAt(note.updatedAt));
            setSaveStatus('saved');
        }
    }, [note.layout, note.pinned, note.title, note.updatedAt]);

    useEffect(() => {
        editSessionIdRef.current = createEditSessionId();
        pendingDraftRef.current = null;
        inFlightSaveRef.current = false;
        flushAfterInFlightRef.current = false;
        isSaveConflictRef.current = false;
        serverUpdatedAtRef.current = note.updatedAt;
        setExternalNoteChange(null);
        setLocalDraft(readLocalDraft(id));
        setEditorContentOverride(null);
        setEditorRevision((current) => current + 1);
        setSaveStatus('saved');
    }, [id, note.updatedAt]);

    useEffect(() => {
        setExternalNoteChange((current) => {
            if (current?.type === 'updated' && current.updatedAt === note.updatedAt) {
                return null;
            }

            return current;
        });
    }, [note.updatedAt]);

    useEffect(() => {
        return subscribeServerEvent((event) => {
            if (event.noteId !== id) {
                return;
            }

            if (event.type === 'mcp.note.updated') {
                if (event.updatedAt === note.updatedAt) {
                    return;
                }

                setExternalNoteChange({
                    type: 'updated',
                    updatedAt: event.updatedAt,
                });
                return;
            }

            if (event.type === 'mcp.note.deleted') {
                setExternalNoteChange({ type: 'deleted' });
            }
        });
    }, [id, note.updatedAt]);

    const { onCreate, onDelete, onPinned, deleteWarningDialog } = useNoteMutate();

    const clearSaveTimer = useCallback(() => {
        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    }, []);

    const setMountedSaveStatus = useCallback((status: SaveStatus) => {
        if (isAliveRef.current) {
            setSaveStatus(status);
        }
    }, []);

    const getCurrentDraft = useCallback(
        (nextTitle = title): NoteSaveDraft => ({
            title: nextTitle,
            content: editorRef.current?.getContent() ?? note.content,
            createdAt: Date.now(),
        }),
        [note.content, title],
    );

    const flushPendingSave = useCallback(
        async ({ ignoreConflict = false, silent = false }: { ignoreConflict?: boolean; silent?: boolean } = {}) => {
            if (inFlightSaveRef.current) {
                flushAfterInFlightRef.current = true;
                return;
            }

            const draft = pendingDraftRef.current;

            if (!draft) {
                return;
            }

            pendingDraftRef.current = null;
            flushAfterInFlightRef.current = false;
            clearSaveTimer();
            inFlightSaveRef.current = true;

            if (!silent) {
                setMountedSaveStatus('saving');
            }

            const response = await updateNote({
                id,
                title: draft.title,
                content: draft.content,
                editSessionId: editSessionIdRef.current,
                ...(ignoreConflict ? {} : { expectedUpdatedAt: serverUpdatedAtRef.current }),
            });

            inFlightSaveRef.current = false;

            if (response.type === 'error') {
                pendingDraftRef.current = draft;
                writeLocalDraft(id, draft);

                const error = response.errors[0];

                if (error.code === NOTE_UPDATE_CONFLICT_CODE && !ignoreConflict) {
                    const currentUpdatedAt = (error.details as { extensions?: { currentUpdatedAt?: string } })
                        ?.extensions?.currentUpdatedAt;

                    isSaveConflictRef.current = true;

                    if (!silent && isAliveRef.current) {
                        setExternalNoteChange({
                            type: 'updated',
                            updatedAt: currentUpdatedAt ?? serverUpdatedAtRef.current,
                        });
                        setMountedSaveStatus('conflict');
                        toast('This note changed elsewhere. Choose how to resolve the draft.');
                    }

                    return;
                }

                if (!silent && isAliveRef.current) {
                    setMountedSaveStatus('error');
                    toast(error.message);
                }

                return;
            }

            isSaveConflictRef.current = false;
            serverUpdatedAtRef.current = response.updateNote.updatedAt;
            clearLocalDraft(id);

            if (!silent && isAliveRef.current) {
                setLastSavedAt(formatSavedAt(response.updateNote.updatedAt));

                if (pendingDraftRef.current) {
                    setSaveStatus('pending');
                } else {
                    setSaveStatus('saved');
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.notes.listAll(),
                        exact: false,
                    });
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.notes.tagListAll(),
                        exact: false,
                    });
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.notes.backReferencesAll(),
                        exact: false,
                    });
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.notes.graph(),
                        exact: true,
                    });
                }
            }

            if (pendingDraftRef.current || flushAfterInFlightRef.current) {
                void flushPendingSave({ silent });
            }
        },
        [clearSaveTimer, id, queryClient, setMountedSaveStatus, toast],
    );

    const queueSave = useCallback(
        (draft: NoteSaveDraft, options: { immediate?: boolean } = {}) => {
            pendingDraftRef.current = draft;
            writeLocalDraft(id, draft);

            if (isSaveConflictRef.current) {
                setMountedSaveStatus('conflict');
                return;
            }

            setMountedSaveStatus('pending');
            clearSaveTimer();

            if (options.immediate) {
                void flushPendingSave();
                return;
            }

            saveTimerRef.current = window.setTimeout(() => {
                void flushPendingSave();
            }, NOTE_AUTOSAVE_DELAY_MS);
        },
        [clearSaveTimer, flushPendingSave, id, setMountedSaveStatus],
    );

    const handleChange = () => {
        queueSave(getCurrentDraft());
    };

    const handleTitleChange = (nextTitle: string) => {
        setTitle(nextTitle);
        queueSave(getCurrentDraft(nextTitle));
    };

    const handleManualSave = () => {
        queueSave(getCurrentDraft(), { immediate: true });
    };

    const handleLayoutSave = async (newLayout: NoteLayout) => {
        const response = await updateNote({
            id,
            layout: newLayout,
            editSessionId: editSessionIdRef.current,
            expectedUpdatedAt: serverUpdatedAtRef.current,
        });

        if (response.type === 'error') {
            if (response.errors[0].code === NOTE_UPDATE_CONFLICT_CODE) {
                isSaveConflictRef.current = true;
                setExternalNoteChange({
                    type: 'updated',
                    updatedAt: serverUpdatedAtRef.current,
                });
                setSaveStatus('conflict');
            }

            toast(response.errors[0].message);
            return;
        }

        serverUpdatedAtRef.current = response.updateNote.updatedAt;
        setLastSavedAt(formatSavedAt(response.updateNote.updatedAt));
        setLayout(newLayout);
        toast('Layout has been updated.');
    };

    const getExportMetadata = () => ({
        id,
        title,
        createdAt: note.createdAt,
        updatedAt: serverUpdatedAtRef.current || note.updatedAt,
    });

    const handleCopyMarkdown = async () => {
        const markdown = editorRef.current?.getMarkdown();

        if (markdown === undefined) {
            toast('Markdown is not ready yet.');
            return;
        }

        try {
            await navigator.clipboard.writeText(markdown);
            toast('Copied note as Markdown.');
        } catch {
            toast('Failed to copy Markdown.');
        }
    };

    const handleDownloadMarkdown = () => {
        const markdown = editorRef.current?.getMarkdown();

        if (markdown === undefined) {
            toast('Markdown is not ready yet.');
            return;
        }

        try {
            downloadTextFile(markdown, getNoteExportFilename(title, 'md'), 'text/markdown;charset=utf-8');
            toast('Downloaded note as Markdown.');
        } catch {
            toast('Failed to download Markdown.');
        }
    };

    const handleDownloadOtherFormat = () => {
        const metadata = getExportMetadata();

        try {
            if (exportFormat === 'markdown') {
                const markdown = editorRef.current?.getMarkdown();

                if (markdown === undefined) {
                    toast('Markdown is not ready yet.');
                    return;
                }

                downloadTextFile(
                    createMarkdownExport(markdown, metadata, includeMetadata),
                    getNoteExportFilename(title, 'md'),
                    'text/markdown;charset=utf-8',
                );
            } else {
                const html = editorRef.current?.getHtml();

                if (html === undefined) {
                    toast('HTML is not ready yet.');
                    return;
                }

                downloadTextFile(
                    createHtmlExport(html, metadata, { includeMetadata, mode: htmlExportMode }),
                    getNoteExportFilename(title, 'html'),
                    'text/html;charset=utf-8',
                );
            }

            setIsExportModalOpen(false);
            toast('Downloaded note.');
        } catch {
            toast('Failed to download note.');
        }
    };

    const handleReloadExternalChange = async () => {
        clearSaveTimer();

        const response = await noteQuery.refetch();

        if (response.error || !response.data) {
            toast('Failed to reload the latest note state.');
            return;
        }

        pendingDraftRef.current = null;
        flushAfterInFlightRef.current = false;
        isSaveConflictRef.current = false;
        clearLocalDraft(id);
        setLocalDraft(null);
        setSaveStatus('saved');
        serverUpdatedAtRef.current = response.data.updatedAt;
        setTitle(response.data.title);
        setLayout(response.data.layout || 'wide');
        setLastSavedAt(formatSavedAt(response.data.updatedAt));
        setEditorContentOverride(null);
        setEditorRevision((current) => current + 1);
        setExternalNoteChange(null);
    };

    const handleOverwriteConflict = async () => {
        isSaveConflictRef.current = false;
        setExternalNoteChange(null);
        await flushPendingSave({ ignoreConflict: true });
    };

    const handleClonePendingDraft = async () => {
        const draft = pendingDraftRef.current ?? getCurrentDraft();
        clearSaveTimer();
        pendingDraftRef.current = null;
        flushAfterInFlightRef.current = false;
        isSaveConflictRef.current = false;
        clearLocalDraft(id);
        setSaveStatus('saved');
        await onCreate(draft.title || 'untitled', draft.content, layout);
    };

    const handleRestoreLocalDraft = () => {
        if (!localDraft) {
            return;
        }

        setTitle(localDraft.title);
        setEditorContentOverride(localDraft.content);
        setEditorRevision((current) => current + 1);
        queueSave(localDraft);
        setLocalDraft(null);
    };

    const handleDiscardLocalDraft = () => {
        clearLocalDraft(id);
        setLocalDraft(null);
    };

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!pendingDraftRef.current && !inFlightSaveRef.current && !isSaveConflictRef.current) {
                return;
            }

            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        return () => {
            clearSaveTimer();

            if (pendingDraftRef.current && !isSaveConflictRef.current) {
                void flushPendingSave({ silent: true });
            }
        };
    }, [clearSaveTimer, flushPendingSave]);

    const saveStatusText =
        saveStatus === 'pending'
            ? 'Unsaved changes'
            : saveStatus === 'saving'
              ? 'Saving...'
              : saveStatus === 'error'
                ? 'Save failed. Try again.'
                : saveStatus === 'conflict'
                  ? 'Save paused: changed elsewhere'
                  : `Last saved ${lastSavedAt}`;
    const isConflictedExternalUpdate = saveStatus === 'conflict' && externalNoteChange?.type === 'updated';

    return (
        <PageLayout title={title} variant="none">
            <main className={classNames('mx-auto', NOTE_LAYOUT_WIDTH[layout])}>
                <div className="surface-floating sticky top-20 z-[1001] mb-7 px-5 pt-4 pb-3.5">
                    <div className="flex flex-col gap-3.5">
                        <div className="flex items-start justify-between gap-5">
                            <div className="min-w-0 flex-1 pt-0.5">
                                <Text
                                    as="div"
                                    variant="micro"
                                    weight="semibold"
                                    tracking="widest"
                                    transform="uppercase"
                                    tone="tertiary"
                                    className="mb-1.5"
                                >
                                    Thought in progress
                                </Text>
                                <input
                                    ref={titleRef}
                                    placeholder="Title"
                                    className="text-heading sm:text-display w-full bg-transparent font-semibold leading-[1.25] tracking-[-0.02em] outline-none"
                                    type="text"
                                    value={title}
                                    onChange={(event) => handleTitleChange(event.target.value)}
                                />
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <Dropdown
                                    button={<MoreButton label="Note actions" size="lg" />}
                                    items={[
                                        {
                                            name: 'Copy Markdown',
                                            onClick: handleCopyMarkdown,
                                        },
                                        {
                                            name: 'Download Markdown',
                                            onClick: handleDownloadMarkdown,
                                        },
                                        {
                                            name: 'Download in another format',
                                            onClick: () => setIsExportModalOpen(true),
                                        },
                                        { type: 'separator', key: 'export-separator' },
                                        {
                                            name: isPinned ? 'Unpin' : 'Pin',
                                            onClick: () =>
                                                onPinned(id, isPinned, () => {
                                                    setIsPinned((prev) => !prev);
                                                }),
                                        },
                                        {
                                            name: 'Change layout',
                                            onClick: () => setIsLayoutModalOpen(true),
                                        },
                                        { type: 'separator' },
                                        {
                                            name: 'Clone this note',
                                            onClick: () =>
                                                onCreate(
                                                    titleRef.current?.value || 'untitled',
                                                    editorRef.current?.getContent() || '',
                                                    layout,
                                                ),
                                        },
                                        {
                                            name: 'Restore previous version',
                                            onClick: () => setIsRestoreModalOpen(true),
                                        },
                                        { type: 'separator' },
                                        {
                                            name: 'Delete',
                                            onClick: () =>
                                                onDelete(id, () => {
                                                    navigate({
                                                        to: SETTINGS_TRASH_ROUTE,
                                                        search: { page: 1 },
                                                    });
                                                }),
                                        },
                                    ]}
                                />
                                <Button
                                    size="sm"
                                    variant="subtle"
                                    isLoading={saveStatus === 'saving'}
                                    disabled={saveStatus === 'conflict'}
                                    onClick={handleManualSave}
                                >
                                    Save
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-border-subtle/80 pt-3">
                            {isPinned && (
                                <Text
                                    as="span"
                                    variant="label"
                                    weight="medium"
                                    tone="secondary"
                                    className="inline-flex items-center gap-1.5"
                                >
                                    <Icon.Pin className="h-3 w-3" weight="fill" />
                                    Pinned
                                </Text>
                            )}
                            {isPinned && <span className="h-1 w-1 rounded-full bg-border-secondary" />}
                            <Text
                                as="span"
                                variant="label"
                                weight="medium"
                                tone={saveStatus === 'error' || saveStatus === 'conflict' ? 'error' : 'secondary'}
                            >
                                {saveStatusText}
                            </Text>
                        </div>
                    </div>
                </div>

                {localDraft && (
                    <Callout className="mb-6">
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                An unsaved local draft from {dayjs(localDraft.createdAt).format('YYYY-MM-DD HH:mm:ss')}{' '}
                                is available.
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="subtle"
                                    className="self-start"
                                    onClick={handleRestoreLocalDraft}
                                >
                                    Restore draft
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="self-start"
                                    onClick={handleDiscardLocalDraft}
                                >
                                    Discard
                                </Button>
                            </div>
                        </div>
                    </Callout>
                )}

                {externalNoteChange && (
                    <Callout className="mb-6">
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                {isConflictedExternalUpdate
                                    ? 'This note changed elsewhere before your draft saved. Reload latest, overwrite it, or clone your draft.'
                                    : externalNoteChange.type === 'updated'
                                      ? 'This note changed in MCP. Reload to review the latest version.'
                                      : 'This note was moved to trash from MCP. Open trash to review it.'}
                            </span>
                            {externalNoteChange.type === 'updated' ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="subtle"
                                        className="self-start"
                                        isLoading={noteQuery.isRefetching}
                                        onClick={handleReloadExternalChange}
                                    >
                                        Reload
                                    </Button>
                                    {isConflictedExternalUpdate && (
                                        <>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="primary"
                                                className="self-start"
                                                onClick={() => void handleOverwriteConflict()}
                                            >
                                                Overwrite
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="self-start"
                                                onClick={() => void handleClonePendingDraft()}
                                            >
                                                Clone draft
                                            </Button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="subtle"
                                    className="self-start"
                                    onClick={() =>
                                        navigate({
                                            to: SETTINGS_TRASH_ROUTE,
                                            search: { page: 1 },
                                        })
                                    }
                                >
                                    Open trash
                                </Button>
                            )}
                        </div>
                    </Callout>
                )}

                <Editor
                    key={`${id}:${note.updatedAt}:${editorRevision}`}
                    ref={editorRef}
                    content={editorContentOverride ?? note.content}
                    currentNoteId={id}
                    onChange={handleChange}
                />

                <QueryBoundary
                    fallback={<Skeleton className="mb-5" height="80px" />}
                    errorTitle="Failed to load reminders"
                    errorDescription="Retry loading reminder details for this note."
                    renderError={({ error, retry }) => (
                        <QueryErrorView
                            title="Failed to load reminders"
                            description="Retry loading reminder details for this note."
                            error={error}
                            onRetry={retry}
                            showBackAction={false}
                            showHomeAction={false}
                        />
                    )}
                >
                    <ReminderPanel noteId={id} />
                </QueryBoundary>

                <QueryBoundary
                    fallback={<Skeleton height="80px" />}
                    errorTitle="Failed to load back references"
                    errorDescription="Retry loading notes that link back here."
                    renderError={({ error, retry }) => (
                        <QueryErrorView
                            title="Failed to load back references"
                            description="Retry loading notes that link back here."
                            error={error}
                            onRetry={retry}
                            showBackAction={false}
                            showHomeAction={false}
                        />
                    )}
                >
                    <BackReferences
                        noteId={id}
                        render={(backReferences) =>
                            backReferences &&
                            backReferences.length > 0 && (
                                <div className="surface-base p-4">
                                    <AuxiliaryPanelHeader
                                        icon={<Icon.LinkSimple className="h-3.5 w-3.5" />}
                                        title="Back References"
                                        className="mb-3 text-fg-tertiary"
                                    />
                                    <ul className="flex flex-col">
                                        {backReferences.map((backLink) => (
                                            <li key={backLink.id}>
                                                <Link
                                                    to={NOTE_ROUTE}
                                                    params={{ id: backLink.id }}
                                                    className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-fg-secondary transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                                >
                                                    <Icon.File className="h-3.5 w-3.5 shrink-0 text-fg-tertiary" />
                                                    <Text
                                                        as="span"
                                                        variant="body"
                                                        weight="medium"
                                                        className="text-current"
                                                    >
                                                        {backLink.title}
                                                    </Text>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )
                        }
                    />
                </QueryBoundary>

                <LayoutModal
                    isOpen={isLayoutModalOpen}
                    onClose={() => setIsLayoutModalOpen(false)}
                    onSave={handleLayoutSave}
                    currentLayout={layout}
                />
                <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} variant="compact">
                    <Modal.Header title="Download in another format" onClose={() => setIsExportModalOpen(false)} />
                    <Modal.Body>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Text as="div" variant="body" weight="semibold" tone="secondary">
                                    Format
                                </Text>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <SelectionOptionCard
                                        title="Markdown"
                                        description="Good for GitHub, static blogs, and other note apps."
                                        selected={exportFormat === 'markdown'}
                                        onClick={() => setExportFormat('markdown')}
                                    />
                                    <SelectionOptionCard
                                        title="HTML"
                                        description="Good for web documents or CMS editors."
                                        selected={exportFormat === 'html'}
                                        onClick={() => setExportFormat('html')}
                                    />
                                </div>
                            </div>

                            <div className="flex items-start gap-3 rounded-[14px] border border-border-subtle bg-subtle/60 p-3">
                                <Checkbox
                                    size="sm"
                                    checked={includeMetadata}
                                    onChange={(event) => setIncludeMetadata(event.target.checked)}
                                    className="mt-0.5"
                                    aria-label="Include metadata"
                                />
                                <div className="flex flex-col gap-1">
                                    <Text as="span" variant="body" weight="semibold">
                                        Include metadata
                                    </Text>
                                    <Text as="span" variant="label" tone="tertiary">
                                        Add the title, note id, timestamps, and Ocean Brain source information.
                                    </Text>
                                </div>
                            </div>

                            {exportFormat === 'html' && (
                                <div className="flex flex-col gap-2">
                                    <Text as="div" variant="body" weight="semibold" tone="secondary">
                                        HTML style
                                    </Text>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <SelectionOptionCard
                                            title="Content only"
                                            description="Save only the note body HTML."
                                            selected={htmlExportMode === 'fragment'}
                                            onClick={() => setHtmlExportMode('fragment')}
                                        />
                                        <SelectionOptionCard
                                            title="Full HTML document"
                                            description="Save a complete HTML file that opens in a browser."
                                            selected={htmlExportMode === 'standalone'}
                                            onClick={() => setHtmlExportMode('standalone')}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <ModalActionRow>
                            <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" size="sm" onClick={handleDownloadOtherFormat}>
                                Download
                            </Button>
                        </ModalActionRow>
                    </Modal.Footer>
                </Modal>
                <RestoreSnapshotModal
                    isOpen={isRestoreModalOpen}
                    noteId={id}
                    onClose={() => setIsRestoreModalOpen(false)}
                    onRestored={(restoredNote) => {
                        editSessionIdRef.current = createEditSessionId();
                        serverUpdatedAtRef.current = restoredNote.updatedAt;
                        clearLocalDraft(id);
                        pendingDraftRef.current = null;
                        isSaveConflictRef.current = false;
                        setLastSavedAt(formatSavedAt(restoredNote.updatedAt));
                        setSaveStatus('saved');
                    }}
                />
                {deleteWarningDialog}
            </main>
        </PageLayout>
    );
}

export default function Note() {
    const { id } = Route.useParams();

    if (!id) {
        throw new Error('Note id is required.');
    }

    return (
        <QueryBoundary
            fallback={notePageFallback}
            errorTitle="Failed to load note"
            errorDescription="Retry loading the note editor."
            resetKeys={[id]}
            renderError={({ error, retry }) => (
                <PageLayout title="Note" variant="none">
                    <QueryErrorView
                        title="Failed to load note"
                        description="Retry loading the note editor."
                        error={error}
                        onRetry={retry}
                    />
                </PageLayout>
            )}
        >
            <NoteContent key={id} id={id} />
        </QueryBoundary>
    );
}
