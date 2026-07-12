import { getRouteApi, Link } from '@tanstack/react-router';
import classNames from 'classnames';
import { useState } from 'react';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { BackReferences } from '~/components/entities';
import * as Icon from '~/components/icon';
import {
    LayoutModal,
    NoteEditorHeader,
    NoteExportModal,
    NoteExternalChangeModal,
    NotePropertiesPanel,
    NoteRecoveryCallouts,
    RestoreSnapshotModal,
} from '~/components/note';
import { ReminderPanel } from '~/components/reminder';
import { AuxiliaryPanel, PageLayout, Skeleton } from '~/components/shared';
import Editor from '~/components/shared/Editor';
import { Text, useToast } from '~/components/ui';
import useNoteMutate from '~/hooks/resource/useNoteMutate';
import { useNoteEditorSession } from '~/hooks/useNoteEditorSession';
import type { NoteLayout } from '~/models/note.model';
import { NOTE_ROUTE, SETTINGS_TRASH_ROUTE } from '~/modules/url';

const Route = getRouteApi(NOTE_ROUTE);

const NOTE_LAYOUT_WIDTH: Record<NoteLayout, string> = {
    narrow: 'max-w-[640px]',
    wide: 'max-w-[896px]',
    full: 'max-w-full px-4',
};

const notePageFallback = (
    <PageLayout title="Loading note" variant="none">
        <main className="mx-auto max-w-[896px]">
            <Skeleton className="mb-8" height={123} />
            <div className="flex flex-col gap-5">
                <Skeleton height={135} />
                <Skeleton className="ml-12" height={320} />
                <Skeleton height={107} />
                <Skeleton height={100} />
            </div>
        </main>
    </PageLayout>
);

function NoteReminders({ noteId }: { noteId: string }) {
    return (
        <QueryBoundary
            fallback={<Skeleton height={107} />}
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
            <ReminderPanel noteId={noteId} />
        </QueryBoundary>
    );
}

function NoteBackReferences({ noteId }: { noteId: string }) {
    return (
        <QueryBoundary
            fallback={<Skeleton height={100} />}
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
                noteId={noteId}
                render={(backReferences) =>
                    backReferences?.length ? (
                        <AuxiliaryPanel icon={<Icon.LinkSimple className="h-3.5 w-3.5" />} title="Back References">
                            <ul className="flex flex-col">
                                {backReferences.map((backLink) => (
                                    <li key={backLink.id}>
                                        <Link
                                            to={NOTE_ROUTE}
                                            params={{ id: backLink.id }}
                                            className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-fg-secondary transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                        >
                                            <Icon.File className="h-3.5 w-3.5 shrink-0 text-fg-tertiary" />
                                            <Text as="span" variant="body" weight="medium" className="text-current">
                                                {backLink.title}
                                            </Text>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </AuxiliaryPanel>
                    ) : null
                }
            />
        </QueryBoundary>
    );
}

interface NoteContentProps {
    id: string;
}

export function NoteContent({ id }: NoteContentProps) {
    const notify = useToast();
    const navigate = Route.useNavigate();
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const session = useNoteEditorSession({
        noteId: id,
        notify,
        navigateToNote: (noteId) =>
            navigate({
                to: NOTE_ROUTE,
                params: { id: noteId },
            }),
    });
    const { onCreate, onDelete, deleteWarningDialog } = useNoteMutate();
    const { document, editor, save, recovery, externalChange, properties, exportDocument, snapshots } = session;

    const openTrash = () =>
        navigate({
            to: SETTINGS_TRASH_ROUTE,
            search: { page: 1 },
        });

    const handleDelete = async () => {
        const flushResult = await save.flushPendingChanges();

        if (flushResult === 'error' || flushResult === 'conflict') {
            return;
        }

        await onDelete(id, openTrash);
    };

    const handleCloneNote = async () => {
        const flushResult = await save.flushPendingChanges();

        if (flushResult === 'error' || flushResult === 'conflict') {
            return;
        }

        await onCreate(document.titleRef.current?.value || 'untitled', editor.getContent(), document.getLayout());
    };

    return (
        <PageLayout title={document.title} variant="none">
            <main className={classNames('mx-auto', NOTE_LAYOUT_WIDTH[document.layout])}>
                <NoteEditorHeader
                    title={document.title}
                    titleRef={document.titleRef}
                    isPinned={document.isPinned}
                    createdAt={document.createdAt}
                    saveStatus={save.status}
                    savedAt={save.lastSavedAt}
                    savedVersion={save.lastSavedVersion}
                    saveConfirmationRevision={save.confirmationRevision}
                    onTitleChange={document.onTitleChange}
                    onCopyMarkdown={() => void exportDocument.onCopyMarkdown()}
                    onDownloadDocument={() => setIsExportModalOpen(true)}
                    onTogglePinned={() => void document.onTogglePinned()}
                    onChangeLayout={() => setIsLayoutModalOpen(true)}
                    onCloneNote={() => void handleCloneNote()}
                    onRestoreVersion={() => setIsRestoreModalOpen(true)}
                    onDelete={() => void handleDelete()}
                    onSave={save.onManualSave}
                />

                <NoteRecoveryCallouts
                    localDraftCreatedAt={recovery.localDraftCreatedAt}
                    hasSaveError={save.status === 'error'}
                    onRestoreDraft={recovery.onRestoreLocalDraft}
                    onDiscardDraft={recovery.onDiscardLocalDraft}
                    onRetrySave={save.onManualSave}
                    onSaveAsNewNote={() => void recovery.onClonePendingDraft()}
                />

                <div className="flex flex-col gap-5">
                    <NotePropertiesPanel
                        ref={properties.ref}
                        noteId={id}
                        properties={document.properties}
                        expectedUpdatedAt={properties.expectedUpdatedAt}
                        editSessionId={properties.editSessionId}
                        disabled={save.status !== 'saved'}
                        saveProperties={properties.saveProperties}
                        onPendingChange={properties.onPendingChange}
                        onSaved={properties.onSaved}
                    />

                    <Editor
                        key={editor.key}
                        ref={editor.ref}
                        content={editor.content}
                        currentNoteId={id}
                        onChange={editor.onChange}
                    />

                    <NoteReminders noteId={id} />
                    <NoteBackReferences noteId={id} />
                </div>

                <LayoutModal
                    isOpen={isLayoutModalOpen}
                    onClose={() => setIsLayoutModalOpen(false)}
                    onSave={document.onLayoutSave}
                    currentLayout={document.layout}
                />
                <NoteExternalChangeModal
                    isOpen={externalChange.isBlocking}
                    isDeleted={externalChange.value?.type === 'deleted'}
                    isConflict={externalChange.isConflict}
                    hasDraft={externalChange.hasConflictDraft}
                    source={externalChange.value?.source ?? 'unknown'}
                    isReloading={externalChange.isReloading}
                    onReload={() => void externalChange.onReload()}
                    onOverwrite={() => void externalChange.onOverwrite()}
                    onCloneDraft={() => void recovery.onClonePendingDraft()}
                    onOpenTrash={() => void openTrash()}
                />
                <NoteExportModal
                    isOpen={isExportModalOpen}
                    metadata={exportDocument.metadata}
                    getHtml={editor.getHtml}
                    getMarkdown={editor.getMarkdown}
                    onClose={() => setIsExportModalOpen(false)}
                />
                <RestoreSnapshotModal
                    isOpen={isRestoreModalOpen}
                    noteId={id}
                    onClose={() => setIsRestoreModalOpen(false)}
                    restoreSnapshot={snapshots.restore}
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
