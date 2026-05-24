import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import classNames from 'classnames';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';
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
import { useNoteSaveController } from '~/hooks/useNoteSaveController';
import type { Note, NoteLayout } from '~/models/note.model';
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
const NOTE_UPDATE_CONFLICT_CODE = 'NOTE_UPDATE_CONFLICT';

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
type NoteDetailCache = Pick<Note, 'title' | 'content' | 'pinned' | 'layout' | 'createdAt' | 'updatedAt'>;

function NoteContent({ id }: NoteContentProps) {
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
    const appliedNoteVersionRef = useRef(note.updatedAt);
    const saveController = useNoteSaveController({
        noteId: id,
        initialContent: note.content,
        initialUpdatedAt: note.updatedAt,
        editSessionIdRef,
        getContent: () => editorRef.current?.getContent(),
        onSaved: (updatedAt) => {
            setLastSavedAt(formatSavedAt(updatedAt));
        },
        onConflict: (updatedAt) => {
            setExternalNoteChange({
                type: 'updated',
                updatedAt,
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
        pauseForConflict,
        getPendingDraft,
        setServerUpdatedAt,
    } = saveController;

    useEffect(() => {
        if (hasUnsavedChanges) {
            if (note.updatedAt !== serverUpdatedAtRef.current) {
                pauseForConflict(note.updatedAt);
            }

            return;
        }

        setIsPinned(note.pinned);
        setLayout(note.layout || 'wide');
        setServerUpdatedAt(note.updatedAt);
        setTitle(note.title);
        setLastSavedAt(formatSavedAt(note.updatedAt));

        if (appliedNoteVersionRef.current !== note.updatedAt) {
            appliedNoteVersionRef.current = note.updatedAt;
            setEditorContentOverride(null);
            setEditorRevision((current) => current + 1);
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
    ]);

    useEffect(() => {
        editSessionIdRef.current = createEditSessionId();
        appliedNoteVersionRef.current = note.updatedAt;
        setExternalNoteChange(null);
        setEditorContentOverride(null);
        setEditorRevision((current) => current + 1);
    }, [id]);

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

                if (hasUnsavedChanges) {
                    pauseForConflict(event.updatedAt);
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
    }, [hasUnsavedChanges, id, note.updatedAt, pauseForConflict]);

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
                pauseForConflict(serverUpdatedAtRef.current);
            }

            toast(response.errors[0].message);
            return;
        }

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
        const response = await noteQuery.refetch();

        if (response.error || !response.data) {
            toast('Failed to reload the latest note state.');
            return;
        }

        clearDrafts();
        setServerUpdatedAt(response.data.updatedAt);
        setTitle(response.data.title);
        setLayout(response.data.layout || 'wide');
        setLastSavedAt(formatSavedAt(response.data.updatedAt));
        setEditorContentOverride(null);
        setEditorRevision((current) => current + 1);
        setExternalNoteChange(null);
    };

    const handleOverwriteConflict = async () => {
        setExternalNoteChange(null);
        await flushPendingSave({ ignoreConflict: true });
    };

    const handleClonePendingDraft = async () => {
        const draft = getPendingDraft() ?? buildDraft(title);
        const createdId = await onCreate(draft.title || 'untitled', draft.content, layout);

        if (createdId) {
            clearDrafts();
        }
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
                                      ? 'This note changed outside this editor. Reload to review the latest version.'
                                      : 'This note was moved to trash outside this editor. Open trash to review it.'}
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
                        setServerUpdatedAt(restoredNote.updatedAt);
                        setLastSavedAt(formatSavedAt(restoredNote.updatedAt));
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
