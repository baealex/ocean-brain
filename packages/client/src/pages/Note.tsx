import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useBlocker } from '@tanstack/react-router';
import classNames from 'classnames';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createNote, fetchNote, updateNote } from '~/apis/note.api';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { BackReferences } from '~/components/entities';
import * as Icon from '~/components/icon';
import { LayoutModal, NoteExternalChangeModal, RestoreSnapshotModal } from '~/components/note';
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
import { useNoteSaveController } from '~/hooks/useNoteSaveController';
import type { Note, NoteLayout } from '~/models/note.model';
import { replaceFixedPlaceholder } from '~/modules/fixed-placeholder';
import {
    createHtmlExport,
    createMarkdownExport,
    downloadTextFile,
    getNoteExportFilename,
    type HtmlExportMode,
} from '~/modules/note-export';
import { queryKeys } from '~/modules/query-key-factory';
import { publishClientNoteUpdatedEvent, subscribeServerEvent } from '~/modules/server-events';
import { getRecentTimeSinceRefreshDelay, recentTimeSince } from '~/modules/time';
import { NOTE_ROUTE, SETTINGS_TRASH_ROUTE } from '~/modules/url';

const Route = getRouteApi(NOTE_ROUTE);

const toNoteVersionTime = (updatedAt: string) => {
    const timestamp = /^\d+$/.test(updatedAt) ? Number(updatedAt) : Date.parse(updatedAt);

    return Number.isFinite(timestamp) ? timestamp : null;
};

const formatSavedAt = (updatedAt: string) => {
    const timestamp = toNoteVersionTime(updatedAt);

    return dayjs(timestamp ?? Number(updatedAt)).format('YYYY-MM-DD HH:mm:ss');
};

const formatSavedAgo = (updatedAt: string, now: number) => {
    return recentTimeSince(toNoteVersionTime(updatedAt), now);
};

const createEditSessionId = () => nanoid();
const NOTE_UPDATE_CONFLICT_CODE = 'NOTE_UPDATE_CONFLICT';
const SAVE_CONFIRMATION_DURATION_MS = 2200;

const getConflictUpdatedAt = (details: unknown) => {
    return (details as { extensions?: { currentUpdatedAt?: string } })?.extensions?.currentUpdatedAt;
};

const compareNoteVersions = (left: string, right: string) => {
    const leftTime = toNoteVersionTime(left);
    const rightTime = toNoteVersionTime(right);

    if (leftTime === null || rightTime === null) {
        return left === right ? 0 : 1;
    }

    return leftTime - rightTime;
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

type ExternalNoteChangeSource = 'web' | 'mcp' | 'unknown';
type ExternalNoteChange =
    | { type: 'updated'; updatedAt: string; source: ExternalNoteChangeSource }
    | { type: 'deleted'; source: ExternalNoteChangeSource };
type NoteDetailCache = Pick<Note, 'title' | 'content' | 'pinned' | 'layout' | 'createdAt' | 'updatedAt'>;

export function NoteContent({ id }: NoteContentProps) {
    const toast = useToast();
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();
    const editorRef = useRef<EditorRef>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const editSessionIdRef = useRef<string>(createEditSessionId());

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

    const [title, setTitle] = useState(note.title);
    const [lastSavedAt, setLastSavedAt] = useState(() => formatSavedAt(note.updatedAt));
    const [lastSavedVersion, setLastSavedVersion] = useState(note.updatedAt);
    const [relativeNow, setRelativeNow] = useState(() => Date.now());
    const [isPinned, setIsPinned] = useState(note.pinned);
    const [layout, setLayout] = useState<NoteLayout>(note.layout || 'wide');
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<'markdown' | 'html'>('markdown');
    const [includeMetadata, setIncludeMetadata] = useState(false);
    const [htmlExportMode, setHtmlExportMode] = useState<HtmlExportMode>('fragment');
    const [externalNoteChange, setExternalNoteChange] = useState<ExternalNoteChange | null>(null);
    const [editorContentOverride, setEditorContentOverride] = useState<string | null>(null);
    const [editorRevision, setEditorRevision] = useState(0);
    const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
    const appliedNoteVersionRef = useRef(note.updatedAt);
    const activeNoteIdRef = useRef(id);
    const layoutConflictRef = useRef<NoteLayout | null>(null);
    const allowNextNavigationRef = useRef(false);
    const updateLastSavedAt = useCallback((updatedAt: string) => {
        setLastSavedAt(formatSavedAt(updatedAt));
        setLastSavedVersion(updatedAt);
        setRelativeNow(Date.now());
    }, []);
    const saveController = useNoteSaveController({
        noteId: id,
        initialContent: note.content,
        initialUpdatedAt: note.updatedAt,
        editSessionIdRef,
        getContent: () => editorRef.current?.getContent(),
        onSaved: (updatedAt) => {
            layoutConflictRef.current = null;
            appliedNoteVersionRef.current = updatedAt;
            updateLastSavedAt(updatedAt);
            setShowSavedConfirmation(true);
        },
        onConflict: (updatedAt) => {
            setExternalNoteChange({
                type: 'updated',
                updatedAt,
                source: 'unknown',
            });
            toast('This note changed elsewhere. Choose how to resolve the draft.');
        },
        onError: toast,
    });
    const {
        saveStatus,
        localDraft,
        serverUpdatedAtRef,
        hasUnsavedChanges,
        buildDraft,
        queueSave,
        flushPendingSave,
        restoreLocalDraft,
        discardLocalDraft,
        clearDrafts,
        resolveConflict,
        pauseForConflict,
        getPendingDraft,
        setServerUpdatedAt,
    } = saveController;

    const shouldBlockNoteNavigation = useCallback(async () => {
        if (allowNextNavigationRef.current) {
            allowNextNavigationRef.current = false;
            return false;
        }

        if (saveStatus === 'conflict') {
            toast('Resolve the note conflict before leaving.');
            return true;
        }

        const result = await flushPendingSave();

        if (result === 'error') {
            toast('Save failed. Stay on this note and try again.');
            return true;
        }

        return result === 'conflict';
    }, [flushPendingSave, saveStatus, toast]);

    useBlocker({
        disabled: saveStatus === 'saved',
        enableBeforeUnload: false,
        shouldBlockFn: shouldBlockNoteNavigation,
    });

    useEffect(() => {
        if (hasUnsavedChanges) {
            if (
                note.updatedAt !== serverUpdatedAtRef.current &&
                compareNoteVersions(note.updatedAt, serverUpdatedAtRef.current) > 0
            ) {
                pauseForConflict(note.updatedAt);
            }

            return;
        }

        const appliedNoteVersion = appliedNoteVersionRef.current;

        if (note.updatedAt !== appliedNoteVersion && compareNoteVersions(note.updatedAt, appliedNoteVersion) < 0) {
            return;
        }

        setIsPinned(note.pinned);
        setLayout(note.layout || 'wide');
        setServerUpdatedAt(note.updatedAt);
        setTitle(note.title);
        updateLastSavedAt(note.updatedAt);

        if (appliedNoteVersion !== note.updatedAt) {
            const currentEditorContent = editorRef.current?.getContent();

            appliedNoteVersionRef.current = note.updatedAt;

            if (currentEditorContent === undefined || currentEditorContent !== note.content) {
                setEditorContentOverride(null);
                setEditorRevision((current) => current + 1);
            }
        }
    }, [
        hasUnsavedChanges,
        note.layout,
        note.pinned,
        note.title,
        note.updatedAt,
        pauseForConflict,
        serverUpdatedAtRef,
        setServerUpdatedAt,
        updateLastSavedAt,
    ]);

    useEffect(() => {
        if (activeNoteIdRef.current === id) {
            return;
        }

        activeNoteIdRef.current = id;
        editSessionIdRef.current = createEditSessionId();
        appliedNoteVersionRef.current = note.updatedAt;
        layoutConflictRef.current = null;
        setExternalNoteChange(null);
        setEditorContentOverride(null);
        setEditorRevision((current) => current + 1);
        setShowSavedConfirmation(false);
    }, [id, note.updatedAt]);

    useEffect(() => {
        if (saveStatus !== 'saved') {
            return;
        }

        const timer = window.setTimeout(
            () => {
                setRelativeNow(Date.now());
            },
            getRecentTimeSinceRefreshDelay(toNoteVersionTime(lastSavedVersion), relativeNow),
        );

        return () => window.clearTimeout(timer);
    }, [lastSavedVersion, relativeNow, saveStatus]);

    useEffect(() => {
        if (!showSavedConfirmation) {
            return;
        }

        const timer = window.setTimeout(() => {
            setShowSavedConfirmation(false);
        }, SAVE_CONFIRMATION_DURATION_MS);

        return () => window.clearTimeout(timer);
    }, [showSavedConfirmation]);

    useEffect(() => {
        if (
            externalNoteChange?.type !== 'updated' ||
            saveStatus === 'conflict' ||
            externalNoteChange.updatedAt !== note.updatedAt
        ) {
            return;
        }

        appliedNoteVersionRef.current = note.updatedAt;
        setServerUpdatedAt(note.updatedAt);
        updateLastSavedAt(note.updatedAt);
        setExternalNoteChange(null);
    }, [externalNoteChange, note.updatedAt, saveStatus, setServerUpdatedAt, updateLastSavedAt]);

    useEffect(() => {
        return subscribeServerEvent((event) => {
            if (event.noteId !== id) {
                return;
            }

            if (event.source === 'web' && event.editSessionId === editSessionIdRef.current) {
                return;
            }

            if (event.type === 'mcp.note.updated' || event.type === 'web.note.updated') {
                if (event.updatedAt === note.updatedAt || event.updatedAt === serverUpdatedAtRef.current) {
                    return;
                }

                if (hasUnsavedChanges) {
                    pauseForConflict(event.updatedAt);
                    setExternalNoteChange({
                        type: 'updated',
                        updatedAt: event.updatedAt,
                        source: event.source,
                    });
                    return;
                }

                setExternalNoteChange({
                    type: 'updated',
                    updatedAt: event.updatedAt,
                    source: event.source,
                });
                return;
            }

            if (event.type === 'mcp.note.deleted') {
                setExternalNoteChange({ type: 'deleted', source: event.source });
            }
        });
    }, [hasUnsavedChanges, id, note.updatedAt, pauseForConflict, serverUpdatedAtRef]);

    const { onCreate, onDelete, onPinned, deleteWarningDialog } = useNoteMutate();

    const handleChange = () => {
        queueSave(buildDraft(title));
    };

    const handleTitleChange = (nextTitle: string) => {
        setTitle(nextTitle);
        queueSave(buildDraft(nextTitle));
    };

    const handleManualSave = () => {
        queueSave(buildDraft(title), { immediate: true });
    };

    const handleLayoutSave = async (newLayout: NoteLayout) => {
        if (hasUnsavedChanges) {
            setLayout(newLayout);
            queueSave(buildDraft(title, { layout: newLayout }), { immediate: true });
            toast('Layout will be saved with your draft.');
            return;
        }

        const response = await updateNote({
            id,
            layout: newLayout,
            editSessionId: editSessionIdRef.current,
            expectedUpdatedAt: serverUpdatedAtRef.current,
        });

        if (response.type === 'error') {
            if (response.errors[0].code === NOTE_UPDATE_CONFLICT_CODE) {
                layoutConflictRef.current = newLayout;
                setLayout(newLayout);
                pauseForConflict(getConflictUpdatedAt(response.errors[0].details) ?? serverUpdatedAtRef.current);
            }

            toast(response.errors[0].message);
            return;
        }

        layoutConflictRef.current = null;
        await queryClient.cancelQueries({
            queryKey: queryKeys.notes.detail(id),
            exact: true,
        });
        appliedNoteVersionRef.current = response.updateNote.updatedAt;
        setServerUpdatedAt(response.updateNote.updatedAt);
        queryClient.setQueryData<NoteDetailCache>(queryKeys.notes.detail(id), (current) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                layout: newLayout,
                updatedAt: response.updateNote.updatedAt,
            };
        });
        publishClientNoteUpdatedEvent({
            noteId: id,
            updatedAt: response.updateNote.updatedAt,
            editSessionId: editSessionIdRef.current,
        });
        updateLastSavedAt(response.updateNote.updatedAt);
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
        const response = await noteQuery.refetch();

        if (response.error || !response.data) {
            toast('Failed to reload the latest note state.');
            return;
        }

        clearDrafts();
        layoutConflictRef.current = null;
        appliedNoteVersionRef.current = response.data.updatedAt;
        setServerUpdatedAt(response.data.updatedAt);
        setTitle(response.data.title);
        setLayout(response.data.layout || 'wide');
        updateLastSavedAt(response.data.updatedAt);
        setEditorContentOverride(null);
        setEditorRevision((current) => current + 1);
        setExternalNoteChange(null);
    };

    const handleOverwriteConflict = async () => {
        const pendingDraft = getPendingDraft();

        if (pendingDraft) {
            layoutConflictRef.current = null;
            setExternalNoteChange(null);
            await flushPendingSave({ ignoreConflict: true });
            return;
        }

        const layoutConflict = layoutConflictRef.current;

        if (layoutConflict) {
            const response = await updateNote({
                id,
                layout: layoutConflict,
                editSessionId: editSessionIdRef.current,
                force: true,
            });

            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }

            layoutConflictRef.current = null;
            await queryClient.cancelQueries({
                queryKey: queryKeys.notes.detail(id),
                exact: true,
            });
            appliedNoteVersionRef.current = response.updateNote.updatedAt;
            resolveConflict();
            setExternalNoteChange(null);
            setServerUpdatedAt(response.updateNote.updatedAt);
            queryClient.setQueryData<NoteDetailCache>(queryKeys.notes.detail(id), (current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    layout: layoutConflict,
                    updatedAt: response.updateNote.updatedAt,
                };
            });
            publishClientNoteUpdatedEvent({
                noteId: id,
                updatedAt: response.updateNote.updatedAt,
                editSessionId: editSessionIdRef.current,
            });
            updateLastSavedAt(response.updateNote.updatedAt);
            setLayout(layoutConflict);
            return;
        }

        setExternalNoteChange(null);
        await flushPendingSave({ ignoreConflict: true });
    };

    const handleClonePendingDraft = async () => {
        const draft = getPendingDraft();

        if (!draft) {
            return;
        }

        const response = await createNote({
            title: replaceFixedPlaceholder(draft.title || 'untitled'),
            content: replaceFixedPlaceholder(draft.content),
            layout: draft.layout ?? layout,
        });

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        allowNextNavigationRef.current = true;
        layoutConflictRef.current = null;
        setExternalNoteChange(null);
        clearDrafts();

        void Promise.resolve(
            navigate({
                to: NOTE_ROUTE,
                params: { id: response.createNote.id },
            }),
        ).finally(() => {
            allowNextNavigationRef.current = false;
        });
    };

    const handleRestoreLocalDraft = () => {
        if (!localDraft) {
            return;
        }

        setTitle(localDraft.title);
        if (localDraft.layout) {
            setLayout(localDraft.layout);
        }
        setEditorContentOverride(localDraft.content);
        setEditorRevision((current) => current + 1);
        restoreLocalDraft(localDraft);
    };

    const handleDiscardLocalDraft = () => {
        discardLocalDraft();
    };

    const recoveredDraftCreatedAt = localDraft ? dayjs(localDraft.createdAt).format('YYYY-MM-DD HH:mm:ss') : null;
    const isRecentSaveVisible = saveStatus === 'saved' && showSavedConfirmation;
    const savedAgoText = formatSavedAgo(lastSavedVersion, relativeNow);
    const createdAtText = formatSavedAt(note.createdAt);
    const saveStatusText =
        saveStatus === 'pending'
            ? 'Saving...'
            : saveStatus === 'saving'
              ? 'Saving now...'
              : saveStatus === 'error'
                ? 'Save failed. Try again.'
                : saveStatus === 'conflict'
                  ? 'Save paused: changed elsewhere'
                  : `Saved ${savedAgoText}`;
    const saveStatusIndicatorClassName = classNames(
        'inline-flex items-center gap-2 transition-colors',
        saveStatus === 'saved' && !isRecentSaveVisible && 'text-fg-secondary',
        isRecentSaveVisible && 'text-accent-success',
        (saveStatus === 'pending' || saveStatus === 'saving') && 'text-fg-default',
        (saveStatus === 'error' || saveStatus === 'conflict') && 'text-fg-error',
    );
    const saveProgressRingClassName = classNames(
        'save-progress-ring flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
        (saveStatus === 'pending' || saveStatus === 'saving') && 'save-progress-ring-active',
        saveStatus === 'saved' && isRecentSaveVisible && 'save-progress-ring-complete',
        (saveStatus === 'error' || saveStatus === 'conflict') && 'save-progress-ring-error',
    );
    const saveStatusIcon =
        saveStatus === 'saving' ? (
            <span className={saveProgressRingClassName} aria-hidden>
                <span className="h-2 w-2 rounded-full bg-elevated" />
            </span>
        ) : saveStatus === 'pending' ? (
            <span className={saveProgressRingClassName} aria-hidden>
                <span className="h-2 w-2 rounded-full bg-elevated" />
            </span>
        ) : saveStatus === 'error' || saveStatus === 'conflict' ? (
            <Icon.WarningCircle className="h-3.5 w-3.5" weight="fill" />
        ) : (
            <span className={saveProgressRingClassName} aria-hidden>
                <span className="h-2 w-2 rounded-full bg-elevated" />
            </span>
        );
    const saveStatusIndicator = (
        <Text
            as="span"
            variant="label"
            weight="medium"
            className={saveStatusIndicatorClassName}
            role="status"
            aria-live="polite"
            title={lastSavedAt}
        >
            {saveStatusIcon}
            {saveStatusText}
        </Text>
    );
    const isConflictedExternalUpdate = saveStatus === 'conflict' && externalNoteChange?.type === 'updated';
    const conflictDraft = isConflictedExternalUpdate ? getPendingDraft() : null;
    const isBlockingExternalChange =
        externalNoteChange !== null &&
        !(
            externalNoteChange.type === 'updated' &&
            !isConflictedExternalUpdate &&
            externalNoteChange.updatedAt === note.updatedAt
        );

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
                            {saveStatusIndicator}
                            <span className="h-1 w-1 rounded-full bg-border-secondary" />
                            <Text as="span" variant="micro" weight="medium" tone="tertiary">
                                Created {createdAtText}
                            </Text>
                        </div>
                    </div>
                </div>

                {localDraft && (
                    <Callout tone="danger" className="mb-6">
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span>A draft from {recoveredDraftCreatedAt} is saved only in this browser.</span>
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

                {saveStatus === 'error' && (
                    <Callout tone="danger" className="mb-6">
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                Save failed. Your latest draft is still available here. Retry before leaving this note.
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="subtle"
                                    className="self-start"
                                    onClick={handleManualSave}
                                >
                                    Retry save
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="self-start"
                                    onClick={() => void handleClonePendingDraft()}
                                >
                                    Save as new note
                                </Button>
                            </div>
                        </div>
                    </Callout>
                )}

                <Editor
                    key={`${id}:${editorRevision}`}
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
                <NoteExternalChangeModal
                    isOpen={isBlockingExternalChange}
                    isDeleted={externalNoteChange?.type === 'deleted'}
                    isConflict={isConflictedExternalUpdate}
                    hasDraft={conflictDraft !== null}
                    source={externalNoteChange?.source ?? 'unknown'}
                    isReloading={noteQuery.isRefetching}
                    onReload={handleReloadExternalChange}
                    onOverwrite={() => void handleOverwriteConflict()}
                    onCloneDraft={() => void handleClonePendingDraft()}
                    onOpenTrash={() =>
                        navigate({
                            to: SETTINGS_TRASH_ROUTE,
                            search: { page: 1 },
                        })
                    }
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
                        clearDrafts();
                        layoutConflictRef.current = null;
                        appliedNoteVersionRef.current = restoredNote.updatedAt;
                        setExternalNoteChange(null);
                        setServerUpdatedAt(restoredNote.updatedAt);
                        updateLastSavedAt(restoredNote.updatedAt);
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
