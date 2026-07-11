import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    createNote,
    fetchNote,
    pinNote,
    restoreNoteSnapshot,
    type UpdateNotePropertiesRequestData,
    updateNote,
    updateNoteProperties,
} from '~/apis/note.api';
import type { NotePropertiesPanelRef } from '~/components/note/NotePropertiesPanel';
import type { EditorRef } from '~/components/shared/Editor';
import type { Note, NoteLayout } from '~/models/note.model';
import { replaceFixedPlaceholder } from '~/modules/fixed-placeholder';
import { createMarkdownDocumentExport } from '~/modules/note-export';
import {
    classifyExternalNoteEvent,
    type ExternalNoteChange,
    isBlockingExternalNoteChange,
} from '~/modules/note-external-change';
import { compareNoteVersions, toNoteVersionTime } from '~/modules/note-version';
import { queryKeys } from '~/modules/query-key-factory';
import { publishClientNoteUpdatedEvent, subscribeServerEvent } from '~/modules/server-events';
import { useNoteNavigationGuard } from './useNoteNavigationGuard';
import { useNoteSaveController } from './useNoteSaveController';
import { useNoteWriteCoordinator } from './useNoteWriteCoordinator';

const NOTE_UPDATE_CONFLICT_CODE = 'NOTE_UPDATE_CONFLICT';

type NoteDetailCache = Pick<Note, 'title' | 'content' | 'pinned' | 'layout' | 'createdAt' | 'updatedAt' | 'properties'>;
type Notify = (message: string) => void;
type NavigateToNote = (noteId: string) => void | Promise<void>;

interface UseNoteEditorSessionParams {
    noteId: string;
    navigateToNote: NavigateToNote;
    notify: Notify;
}

const formatNoteTime = (value: string) => {
    const timestamp = toNoteVersionTime(value);

    return dayjs(timestamp ?? Number(value)).format('YYYY-MM-DD HH:mm:ss');
};

const getConflictUpdatedAt = (details: unknown) => {
    return (details as { extensions?: { currentUpdatedAt?: string } })?.extensions?.currentUpdatedAt;
};

export function useNoteEditorSession({ noteId, navigateToNote, notify }: UseNoteEditorSessionParams) {
    const queryClient = useQueryClient();
    const editorRef = useRef<EditorRef>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const [initialEditSessionId] = useState(nanoid);
    const editSessionIdRef = useRef(initialEditSessionId);
    const propertyPanelRef = useRef<NotePropertiesPanelRef>(null);
    const layoutConflictRef = useRef<NoteLayout | null>(null);
    const allowNextNavigationRef = useRef(false);
    const sessionGenerationRef = useRef(0);

    const noteQuery = useSuspenseQuery({
        queryKey: queryKeys.notes.detail(noteId),
        queryFn: async () => {
            const response = await fetchNote(noteId);

            if (response.type === 'error') {
                throw response;
            }

            return response.note;
        },
        gcTime: 0,
    });
    const note = noteQuery.data;
    const refetchNote = noteQuery.refetch;
    const serverVersionRef = useRef(note.updatedAt);
    const appliedNoteVersionRef = useRef(note.updatedAt);

    const [title, setTitle] = useState(note.title);
    const [isPinned, setIsPinned] = useState(note.pinned);
    const [layout, setLayoutState] = useState<NoteLayout>(note.layout || 'wide');
    const layoutRef = useRef(layout);
    const [externalNoteChange, setExternalNoteChange] = useState<ExternalNoteChange | null>(null);
    const [editorContentOverride, setEditorContentOverride] = useState<string | null>(null);
    const [editorRevision, setEditorRevision] = useState(0);
    const [lastSavedAt, setLastSavedAt] = useState(() => formatNoteTime(note.updatedAt));
    const [lastSavedVersion, setLastSavedVersion] = useState(note.updatedAt);
    const [saveConfirmationRevision, setSaveConfirmationRevision] = useState(0);
    const [hasPendingPropertyChanges, setHasPendingPropertyChanges] = useState(false);
    const hasPendingPropertyChangesRef = useRef(false);
    const {
        execute: executeWrite,
        invalidatePending: invalidatePendingWrites,
        drain: drainWrites,
        isBusy: isWriteBusy,
        hasPendingWrites,
    } = useNoteWriteCoordinator();

    const setLayout = useCallback((nextLayout: NoteLayout) => {
        layoutRef.current = nextLayout;
        setLayoutState(nextLayout);
    }, []);

    const commitAcceptedVersion = useCallback((updatedAt: string, options: { confirmSave?: boolean } = {}) => {
        serverVersionRef.current = updatedAt;
        appliedNoteVersionRef.current = updatedAt;
        setLastSavedAt(formatNoteTime(updatedAt));
        setLastSavedVersion(updatedAt);

        if (options.confirmSave) {
            setSaveConfirmationRevision((revision) => revision + 1);
        }
    }, []);

    const applyAcceptedWrite = useCallback(
        async ({
            updatedAt,
            patch,
            confirmSave = true,
        }: {
            updatedAt: string;
            patch: Partial<NoteDetailCache>;
            confirmSave?: boolean;
        }) => {
            const noteDetailQueryKey = queryKeys.notes.detail(noteId);
            const sessionGeneration = sessionGenerationRef.current;

            await queryClient.cancelQueries({
                queryKey: noteDetailQueryKey,
                exact: true,
            });

            if (sessionGeneration !== sessionGenerationRef.current) {
                return false;
            }

            commitAcceptedVersion(updatedAt, { confirmSave });
            queryClient.setQueryData<NoteDetailCache>(noteDetailQueryKey, (current) =>
                current
                    ? {
                          ...current,
                          ...patch,
                          updatedAt,
                      }
                    : current,
            );
            publishClientNoteUpdatedEvent({
                noteId,
                updatedAt,
                editSessionId: editSessionIdRef.current,
            });
            return true;
        },
        [commitAcceptedVersion, noteId, queryClient],
    );

    const handlePropertyPendingChange = useCallback((hasPendingChanges: boolean) => {
        hasPendingPropertyChangesRef.current = hasPendingChanges;
        setHasPendingPropertyChanges(hasPendingChanges);
    }, []);

    const flushPendingProperties = useCallback(() => {
        return (
            propertyPanelRef.current?.flushPendingSave({
                expectedUpdatedAt: serverVersionRef.current,
            }) ?? Promise.resolve<'idle'>('idle')
        );
    }, []);

    const saveController = useNoteSaveController({
        noteId,
        initialContent: note.content,
        initialUpdatedAt: note.updatedAt,
        editSessionIdRef,
        serverVersionRef,
        executeWrite,
        getContent: () => editorRef.current?.getContent(),
        beforeSave: flushPendingProperties,
        hasExternalPendingChanges: () => hasPendingPropertyChangesRef.current || hasPendingWrites(),
        onSaved: (updatedAt) => {
            layoutConflictRef.current = null;
            commitAcceptedVersion(updatedAt, { confirmSave: true });
        },
        onConflict: (updatedAt) => {
            setExternalNoteChange({
                type: 'updated',
                updatedAt,
                source: 'unknown',
            });
            notify('This note changed elsewhere. Choose how to resolve the draft.');
        },
        onError: notify,
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
    } = saveController;
    const hasSessionUnsavedChanges = hasUnsavedChanges || hasPendingPropertyChanges || isWriteBusy;

    const flushPendingSessionWrites = useCallback(
        async (options?: Parameters<typeof flushPendingSave>[0]) => {
            const result = await flushPendingSave(options);

            if (result === 'error' || result === 'conflict') {
                return result;
            }

            await drainWrites();
            return result;
        },
        [drainWrites, flushPendingSave],
    );

    const saveProperties = useCallback(
        (input: UpdateNotePropertiesRequestData) =>
            executeWrite(async () => {
                const response = await updateNoteProperties({
                    ...input,
                    expectedUpdatedAt: serverVersionRef.current,
                });

                if (response.type === 'success') {
                    await applyAcceptedWrite({
                        updatedAt: response.updateNoteProperties.updatedAt,
                        patch: { properties: response.updateNoteProperties.properties },
                    });
                }

                return response;
            }),
        [applyAcceptedWrite, executeWrite],
    );

    useNoteNavigationGuard({
        allowNextNavigationRef,
        hasExternalPendingChanges: hasPendingPropertyChanges || isWriteBusy,
        saveStatus,
        flushPendingChanges: flushPendingSessionWrites,
        notify,
    });

    useEffect(() => {
        if (hasSessionUnsavedChanges) {
            if (
                note.updatedAt !== serverUpdatedAtRef.current &&
                (compareNoteVersions(note.updatedAt, serverUpdatedAtRef.current) ?? 0) > 0
            ) {
                pauseForConflict(note.updatedAt);
            }

            return;
        }

        const appliedNoteVersion = appliedNoteVersionRef.current;

        if (
            appliedNoteVersion &&
            note.updatedAt !== appliedNoteVersion &&
            (compareNoteVersions(note.updatedAt, appliedNoteVersion) ?? 0) < 0
        ) {
            return;
        }

        setIsPinned(note.pinned);
        setLayout(note.layout || 'wide');
        setTitle(note.title);

        if (appliedNoteVersion !== note.updatedAt) {
            const currentEditorContent = editorRef.current?.getContent();

            commitAcceptedVersion(note.updatedAt);

            if (currentEditorContent === undefined || currentEditorContent !== note.content) {
                setEditorContentOverride(null);
                setEditorRevision((revision) => revision + 1);
            }
        }
    }, [
        commitAcceptedVersion,
        hasSessionUnsavedChanges,
        note.content,
        note.layout,
        note.pinned,
        note.title,
        note.updatedAt,
        pauseForConflict,
        serverUpdatedAtRef,
    ]);

    useEffect(() => {
        if (
            externalNoteChange?.type !== 'updated' ||
            saveStatus === 'conflict' ||
            externalNoteChange.updatedAt !== note.updatedAt
        ) {
            return;
        }

        commitAcceptedVersion(note.updatedAt);
        setExternalNoteChange(null);
    }, [commitAcceptedVersion, externalNoteChange, note.updatedAt, saveStatus]);

    useEffect(() => {
        return subscribeServerEvent((event) => {
            const decision = classifyExternalNoteEvent({
                event,
                noteId,
                editSessionId: editSessionIdRef.current,
                loadedUpdatedAt: note.updatedAt,
                acceptedUpdatedAt: serverUpdatedAtRef.current,
                hasUnsavedChanges: hasSessionUnsavedChanges,
            });

            if (decision.type === 'ignore') {
                return;
            }

            if (decision.shouldPauseSave && decision.change.type === 'updated') {
                pauseForConflict(decision.change.updatedAt);
            }

            setExternalNoteChange(decision.change);
        });
    }, [hasSessionUnsavedChanges, note.updatedAt, noteId, pauseForConflict, serverUpdatedAtRef]);

    const handleContentChange = useCallback(() => {
        queueSave(buildDraft(title));
    }, [buildDraft, queueSave, title]);

    const handleTitleChange = useCallback(
        (nextTitle: string) => {
            setTitle(nextTitle);
            queueSave(buildDraft(nextTitle));
        },
        [buildDraft, queueSave],
    );

    const handleManualSave = useCallback(() => {
        queueSave(buildDraft(title), { immediate: true });
    }, [buildDraft, queueSave, title]);

    const handleLayoutSave = useCallback(
        async (newLayout: NoteLayout) => {
            if (hasUnsavedChanges) {
                setLayout(newLayout);
                queueSave(buildDraft(title, { layout: newLayout }), { immediate: true });
                notify('Layout will be saved with your draft.');
                return;
            }

            const flushResult = await flushPendingSave();

            if (flushResult === 'error' || flushResult === 'conflict') {
                return;
            }

            await executeWrite(async () => {
                const response = await updateNote({
                    id: noteId,
                    layout: newLayout,
                    editSessionId: editSessionIdRef.current,
                    expectedUpdatedAt: serverUpdatedAtRef.current,
                });

                if (response.type === 'error') {
                    if (response.errors[0].code === NOTE_UPDATE_CONFLICT_CODE) {
                        layoutConflictRef.current = newLayout;
                        setLayout(newLayout);
                        pauseForConflict(
                            getConflictUpdatedAt(response.errors[0].details) ?? serverUpdatedAtRef.current,
                        );
                    }

                    notify(response.errors[0].message);
                    return;
                }

                const didCommit = await applyAcceptedWrite({
                    updatedAt: response.updateNote.updatedAt,
                    patch: { layout: newLayout },
                });

                if (!didCommit) {
                    return;
                }

                layoutConflictRef.current = null;
                setLayout(newLayout);
                notify('Layout has been updated.');
            });
        },
        [
            applyAcceptedWrite,
            buildDraft,
            executeWrite,
            flushPendingSave,
            hasUnsavedChanges,
            noteId,
            notify,
            pauseForConflict,
            queueSave,
            serverUpdatedAtRef,
            title,
        ],
    );

    const handleTogglePinned = useCallback(async () => {
        const flushResult = await flushPendingSave();

        if (flushResult === 'error' || flushResult === 'conflict') {
            return;
        }

        const nextPinned = !isPinned;
        await executeWrite(async () => {
            const response = await pinNote(noteId, nextPinned);

            if (response.type === 'error') {
                notify(response.errors[0].message);
                return;
            }

            const didCommit = await applyAcceptedWrite({
                updatedAt: response.pinNote.updatedAt,
                patch: { pinned: nextPinned },
                confirmSave: false,
            });

            if (!didCommit) {
                return;
            }

            setIsPinned(nextPinned);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.listAll(), exact: false }),
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.tagListAll(), exact: false }),
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.pinned(), exact: true }),
            ]);
        });
    }, [applyAcceptedWrite, executeWrite, flushPendingSave, isPinned, noteId, notify, queryClient]);

    const getExportMetadata = useCallback(
        () => ({
            id: noteId,
            title,
            createdAt: note.createdAt,
            updatedAt: serverUpdatedAtRef.current || note.updatedAt,
        }),
        [note.createdAt, note.updatedAt, noteId, serverUpdatedAtRef, title],
    );

    const handleCopyMarkdown = useCallback(async () => {
        const markdown = editorRef.current?.getMarkdown();

        if (markdown === undefined) {
            notify('Markdown is not ready yet.');
            return;
        }

        try {
            await navigator.clipboard.writeText(createMarkdownDocumentExport(markdown, getExportMetadata()));
            notify('Copied note as Markdown.');
        } catch {
            notify('Failed to copy Markdown.');
        }
    }, [getExportMetadata, notify]);

    const handleReloadExternalChange = useCallback(async () => {
        propertyPanelRef.current?.invalidateInFlightSave();
        invalidatePendingWrites();
        await drainWrites();
        sessionGenerationRef.current += 1;
        const response = await refetchNote();

        if (response.error || !response.data) {
            notify('Failed to reload the latest note state.');
            return;
        }

        propertyPanelRef.current?.discardPendingChanges();
        clearDrafts();
        layoutConflictRef.current = null;
        commitAcceptedVersion(response.data.updatedAt);
        setTitle(response.data.title);
        setLayout(response.data.layout || 'wide');
        setEditorContentOverride(null);
        setEditorRevision((revision) => revision + 1);
        setExternalNoteChange(null);
    }, [clearDrafts, commitAcceptedVersion, drainWrites, invalidatePendingWrites, notify, refetchNote]);

    const handleOverwriteConflict = useCallback(async () => {
        const pendingDraft = getPendingDraft();

        if (pendingDraft) {
            layoutConflictRef.current = null;
            setExternalNoteChange(null);
            await flushPendingSave({ ignoreConflict: true });
            return;
        }

        const layoutConflict = layoutConflictRef.current;

        if (!layoutConflict) {
            setExternalNoteChange(null);
            await flushPendingSave({ ignoreConflict: true });
            return;
        }

        await executeWrite(async () => {
            const response = await updateNote({
                id: noteId,
                layout: layoutConflict,
                editSessionId: editSessionIdRef.current,
                force: true,
            });

            if (response.type === 'error') {
                notify(response.errors[0].message);
                return;
            }

            const didCommit = await applyAcceptedWrite({
                updatedAt: response.updateNote.updatedAt,
                patch: { layout: layoutConflict },
            });

            if (!didCommit) {
                return;
            }

            layoutConflictRef.current = null;
            resolveConflict();
            setExternalNoteChange(null);
            setLayout(layoutConflict);
        });
    }, [applyAcceptedWrite, executeWrite, flushPendingSave, getPendingDraft, noteId, notify, resolveConflict]);

    const handleClonePendingDraft = useCallback(async () => {
        const draft = getPendingDraft();

        if (!draft) {
            return;
        }

        const propertySaveResult = await flushPendingProperties();

        if (propertySaveResult === 'error') {
            return;
        }

        const response = await createNote({
            title: replaceFixedPlaceholder(draft.title || 'untitled'),
            content: replaceFixedPlaceholder(draft.content),
            layout: draft.layout ?? layout,
        });

        if (response.type === 'error') {
            notify(response.errors[0].message);
            return;
        }

        allowNextNavigationRef.current = true;
        layoutConflictRef.current = null;
        setExternalNoteChange(null);
        clearDrafts();

        void Promise.resolve(navigateToNote(response.createNote.id)).finally(() => {
            allowNextNavigationRef.current = false;
        });
    }, [clearDrafts, flushPendingProperties, getPendingDraft, layout, navigateToNote, notify]);

    const handleRestoreLocalDraft = useCallback(() => {
        if (!localDraft) {
            return;
        }

        setTitle(localDraft.title);

        if (localDraft.layout) {
            setLayout(localDraft.layout);
        }

        setEditorContentOverride(localDraft.content);
        setEditorRevision((revision) => revision + 1);
        restoreLocalDraft(localDraft);
    }, [localDraft, restoreLocalDraft]);

    const handlePropertiesSaved = useCallback(() => undefined, []);

    const handleRestoreSnapshot = useCallback(
        async (snapshotId: string) => {
            propertyPanelRef.current?.invalidateInFlightSave();
            invalidatePendingWrites();
            await drainWrites();
            sessionGenerationRef.current += 1;
            return executeWrite(async () => {
                const response = await restoreNoteSnapshot(snapshotId);

                if (response.type === 'error') {
                    return response;
                }

                const restoredNote = response.restoreNoteSnapshot;
                const didCommit = await applyAcceptedWrite({
                    updatedAt: restoredNote.updatedAt,
                    patch: {
                        title: restoredNote.title,
                        content: restoredNote.content,
                        layout: restoredNote.layout,
                        pinned: restoredNote.pinned,
                    },
                });

                if (!didCommit) {
                    return response;
                }

                editSessionIdRef.current = nanoid();
                propertyPanelRef.current?.discardPendingChanges();
                clearDrafts();
                layoutConflictRef.current = null;
                setExternalNoteChange(null);
                setTitle(restoredNote.title);
                setLayout(restoredNote.layout || 'wide');
                setIsPinned(restoredNote.pinned);
                setEditorContentOverride(restoredNote.content);
                setEditorRevision((revision) => revision + 1);
                return response;
            });
        },
        [applyAcceptedWrite, clearDrafts, drainWrites, executeWrite, invalidatePendingWrites],
    );

    const isConflictedExternalUpdate = saveStatus === 'conflict' && externalNoteChange?.type === 'updated';
    const conflictDraft = isConflictedExternalUpdate ? getPendingDraft() : null;

    return {
        document: {
            title,
            titleRef,
            isPinned,
            layout,
            getLayout: () => layoutRef.current,
            properties: note.properties,
            createdAt: formatNoteTime(note.createdAt),
            onTitleChange: handleTitleChange,
            onLayoutSave: handleLayoutSave,
            onTogglePinned: handleTogglePinned,
        },
        editor: {
            ref: editorRef,
            key: `${noteId}:${editorRevision}`,
            content: editorContentOverride ?? note.content,
            getContent: () => editorRef.current?.getContent() ?? '',
            getHtml: () => editorRef.current?.getHtml(),
            getMarkdown: () => editorRef.current?.getMarkdown(),
            onChange: handleContentChange,
        },
        save: {
            status: saveStatus,
            lastSavedAt,
            lastSavedVersion,
            confirmationRevision: saveConfirmationRevision,
            onManualSave: handleManualSave,
            flushPendingChanges: flushPendingSessionWrites,
        },
        recovery: {
            localDraftCreatedAt: localDraft ? dayjs(localDraft.createdAt).format('YYYY-MM-DD HH:mm:ss') : null,
            onRestoreLocalDraft: handleRestoreLocalDraft,
            onDiscardLocalDraft: discardLocalDraft,
            onClonePendingDraft: handleClonePendingDraft,
        },
        externalChange: {
            value: externalNoteChange,
            isConflict: isConflictedExternalUpdate,
            hasConflictDraft: conflictDraft !== null,
            isBlocking: isBlockingExternalNoteChange({
                change: externalNoteChange,
                isConflict: isConflictedExternalUpdate,
                loadedUpdatedAt: note.updatedAt,
            }),
            isReloading: noteQuery.isRefetching,
            onReload: handleReloadExternalChange,
            onOverwrite: handleOverwriteConflict,
        },
        properties: {
            ref: propertyPanelRef,
            expectedUpdatedAt: serverUpdatedAtRef.current,
            editSessionId: editSessionIdRef.current,
            saveProperties,
            onPendingChange: handlePropertyPendingChange,
            onSaved: handlePropertiesSaved,
        },
        exportDocument: {
            metadata: getExportMetadata(),
            onCopyMarkdown: handleCopyMarkdown,
        },
        snapshots: {
            restore: handleRestoreSnapshot,
        },
    };
}
