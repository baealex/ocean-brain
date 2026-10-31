import { useQueryClient } from '@tanstack/react-query';
import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createNote, updateNote } from '~/apis/note.api';
import type { Note, NoteLayout } from '~/models/note.model';
import {
    clearLocalNoteDraft,
    type NoteSaveDraft,
    readLocalNoteDraft,
    writeLocalNoteDraft,
} from '~/modules/note-draft-storage';
import { queryKeys } from '~/modules/query-key-factory';
import { invalidateQueriesForNoteChange } from '~/modules/server-event-invalidation';
import { publishClientNoteUpdatedEvent } from '~/modules/server-events';
import type { NoteWriteExecutor } from './useNoteWriteCoordinator';

const NOTE_AUTOSAVE_DELAY_MS = 1000;
const NOTE_UPDATE_CONFLICT_CODE = 'NOTE_UPDATE_CONFLICT';

export type NoteSaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
export type NoteSaveFlushResult = 'idle' | 'saved' | 'error' | 'conflict';

export interface CreatedNoteDraft {
    id: string;
    workspaceId?: string;
    title: string;
    content: string;
    layout?: NoteLayout;
    createdAt: string;
    updatedAt: string;
}

interface UseNoteSaveControllerParams {
    noteId: string | null;
    workspaceId?: string;
    initialContent: string;
    initialUpdatedAt: string;
    editSessionIdRef: MutableRefObject<string>;
    getContent: () => string | undefined;
    beforeSave?: () => Promise<'idle' | 'saved' | 'error'>;
    hasExternalPendingChanges?: () => boolean;
    serverVersionRef?: MutableRefObject<string>;
    executeWrite?: NoteWriteExecutor;
    onSaved: (updatedAt: string) => void;
    onCreated?: (note: CreatedNoteDraft) => void;
    onConflict: (updatedAt: string) => void;
    onError: (message: string) => void;
}

type SaveResponse =
    | Extract<Awaited<ReturnType<typeof updateNote>>, { type: 'error' }>
    | { type: 'success'; saved: Pick<Note, 'id' | 'title' | 'updatedAt'>; created?: CreatedNoteDraft };

interface BuildNoteDraftOptions {
    layout?: NoteSaveDraft['layout'];
}

type NoteDetailCache = Pick<Note, 'title' | 'content' | 'pinned' | 'layout' | 'createdAt' | 'updatedAt'>;

export function useNoteSaveController({
    noteId,
    workspaceId,
    initialContent,
    initialUpdatedAt,
    editSessionIdRef,
    getContent,
    beforeSave,
    hasExternalPendingChanges,
    serverVersionRef,
    executeWrite,
    onSaved,
    onCreated,
    onConflict,
    onError,
}: UseNoteSaveControllerParams) {
    const queryClient = useQueryClient();
    const noteIdRef = useRef(noteId);
    const createdNoteIdRef = useRef<string | null>(null);
    const workspaceIdRef = useRef(workspaceId);
    const saveTimerRef = useRef<number | null>(null);
    const pendingDraftRef = useRef<NoteSaveDraft | null>(null);
    const inFlightSaveRef = useRef(false);
    const inFlightSavePromiseRef = useRef<Promise<NoteSaveFlushResult> | null>(null);
    const flushAfterInFlightRef = useRef(false);
    const internalServerUpdatedAtRef = useRef(initialUpdatedAt);
    const serverUpdatedAtRef = serverVersionRef ?? internalServerUpdatedAtRef;
    const saveGenerationRef = useRef(0);
    const isSaveConflictRef = useRef(false);
    const isAliveRef = useRef(true);
    const onSavedRef = useRef(onSaved);
    const onCreatedRef = useRef(onCreated);
    const onConflictRef = useRef(onConflict);
    const onErrorRef = useRef(onError);
    const beforeSaveRef = useRef(beforeSave);
    const hasExternalPendingChangesRef = useRef(hasExternalPendingChanges);
    const executeWriteRef = useRef(executeWrite);

    const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>('saved');
    const [localDraft, setLocalDraft] = useState<NoteSaveDraft | null>(null);

    const clearSaveTimer = useCallback(() => {
        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    }, []);

    const setMountedSaveStatus = useCallback((status: NoteSaveStatus) => {
        if (isAliveRef.current) {
            setSaveStatus(status);
        }
    }, []);

    const setServerUpdatedAt = useCallback((updatedAt: string) => {
        serverUpdatedAtRef.current = updatedAt;
    }, []);

    const buildDraft = useCallback(
        (title: string, options: BuildNoteDraftOptions = {}): NoteSaveDraft => ({
            title,
            content: getContent() ?? initialContent,
            createdAt: Date.now(),
            baseUpdatedAt: serverUpdatedAtRef.current,
            ...(options.layout ? { layout: options.layout } : {}),
        }),
        [getContent, initialContent],
    );

    const persistCurrentPendingDraft = useCallback(() => {
        if (noteIdRef.current && pendingDraftRef.current) {
            writeLocalNoteDraft(noteIdRef.current, pendingDraftRef.current);
        }
    }, []);

    const setConflict = useCallback(
        (updatedAt?: string) => {
            isSaveConflictRef.current = true;
            setMountedSaveStatus('conflict');
            onConflictRef.current(updatedAt ?? serverUpdatedAtRef.current);
        },
        [setMountedSaveStatus],
    );

    const flushPendingSave = useCallback(
        async ({ ignoreConflict = false, silent = false }: { ignoreConflict?: boolean; silent?: boolean } = {}) => {
            if (inFlightSaveRef.current) {
                flushAfterInFlightRef.current = true;
                return inFlightSavePromiseRef.current ?? 'idle';
            }

            const hasPendingDraft = pendingDraftRef.current !== null;
            const hasExternalPendingChanges = hasExternalPendingChangesRef.current?.() ?? false;

            if (!hasPendingDraft && !hasExternalPendingChanges) {
                flushAfterInFlightRef.current = false;
                return 'idle';
            }

            const saveGeneration = saveGenerationRef.current;
            flushAfterInFlightRef.current = false;
            clearSaveTimer();
            inFlightSaveRef.current = true;

            if (!silent) {
                setMountedSaveStatus('saving');
            }

            const savePromise = (async (): Promise<NoteSaveFlushResult> => {
                const prerequisiteResult = (await beforeSaveRef.current?.()) ?? 'idle';

                if (saveGeneration !== saveGenerationRef.current) {
                    return 'idle';
                }

                if (prerequisiteResult === 'error') {
                    inFlightSaveRef.current = false;
                    inFlightSavePromiseRef.current = null;

                    if (pendingDraftRef.current) {
                        setMountedSaveStatus('error');
                    } else {
                        setMountedSaveStatus('saved');
                    }

                    return 'error';
                }

                const draft = pendingDraftRef.current;

                if (!draft) {
                    inFlightSaveRef.current = false;
                    inFlightSavePromiseRef.current = null;
                    setMountedSaveStatus('saved');
                    return prerequisiteResult;
                }

                pendingDraftRef.current = null;
                const runSaveTransaction = async (): Promise<NoteSaveFlushResult> => {
                    if (saveGeneration !== saveGenerationRef.current) {
                        return 'idle';
                    }

                    const targetNoteId = noteIdRef.current;
                    let response: SaveResponse;

                    try {
                        if (targetNoteId) {
                            const updated = await updateNote({
                                id: targetNoteId,
                                title: draft.title,
                                content: draft.content,
                                ...(draft.layout ? { layout: draft.layout } : {}),
                                editSessionId: editSessionIdRef.current,
                                ...(ignoreConflict
                                    ? { force: true }
                                    : { expectedUpdatedAt: serverUpdatedAtRef.current }),
                            });
                            response =
                                updated.type === 'error' ? updated : { type: 'success', saved: updated.updateNote };
                        } else {
                            const created = await createNote({
                                ...(workspaceIdRef.current ? { workspaceId: workspaceIdRef.current } : {}),
                                title: draft.title,
                                content: draft.content,
                                ...(draft.layout ? { layout: draft.layout } : {}),
                            });
                            response =
                                created.type === 'error'
                                    ? created
                                    : {
                                          type: 'success',
                                          saved: created.createNote,
                                          created: {
                                              ...created.createNote,
                                              content: draft.content,
                                              ...(draft.layout ? { layout: draft.layout } : {}),
                                          },
                                      };
                        }
                    } catch {
                        response = {
                            type: 'error',
                            category: 'network',
                            errors: [
                                {
                                    code: 'NETWORK_ERROR',
                                    message: 'Failed to save note.',
                                },
                            ],
                        };
                    }

                    if (saveGeneration !== saveGenerationRef.current) {
                        return 'idle';
                    }

                    if (response.type === 'error') {
                        inFlightSaveRef.current = false;
                        inFlightSavePromiseRef.current = null;

                        if (!pendingDraftRef.current) {
                            pendingDraftRef.current = draft;
                        }

                        persistCurrentPendingDraft();
                        const error = response.errors[0];

                        if (error.code === NOTE_UPDATE_CONFLICT_CODE && !ignoreConflict) {
                            const currentUpdatedAt = (error.details as { extensions?: { currentUpdatedAt?: string } })
                                ?.extensions?.currentUpdatedAt;
                            isSaveConflictRef.current = true;

                            if (!silent && isAliveRef.current) {
                                setMountedSaveStatus('conflict');
                                onConflictRef.current(currentUpdatedAt ?? serverUpdatedAtRef.current);
                            }

                            return 'conflict';
                        }

                        if (!silent && isAliveRef.current) {
                            setMountedSaveStatus('error');
                            onErrorRef.current(error.message);
                        }

                        return 'error';
                    }

                    const shouldNotifySave = !silent && isAliveRef.current;
                    const savedNoteId = response.saved.id;
                    const noteDetailQueryKey = queryKeys.notes.detail(savedNoteId);

                    if (response.created) {
                        noteIdRef.current = savedNoteId;
                        createdNoteIdRef.current = savedNoteId;
                    }

                    await queryClient.cancelQueries({
                        queryKey: noteDetailQueryKey,
                        exact: true,
                    });

                    if (saveGeneration !== saveGenerationRef.current) {
                        return 'idle';
                    }

                    inFlightSaveRef.current = false;
                    inFlightSavePromiseRef.current = null;
                    isSaveConflictRef.current = false;
                    serverUpdatedAtRef.current = response.saved.updatedAt;

                    if (shouldNotifySave) {
                        onSavedRef.current(response.saved.updatedAt);
                    }

                    if (response.created && isAliveRef.current) {
                        onCreatedRef.current?.(response.created);
                    }

                    queryClient.setQueryData<NoteDetailCache>(noteDetailQueryKey, (current) =>
                        current
                            ? {
                                  ...current,
                                  title: response.saved.title,
                                  content: draft.content,
                                  ...(draft.layout ? { layout: draft.layout } : {}),
                                  updatedAt: response.saved.updatedAt,
                              }
                            : current,
                    );
                    publishClientNoteUpdatedEvent({
                        noteId: savedNoteId,
                        updatedAt: response.saved.updatedAt,
                        editSessionId: editSessionIdRef.current,
                    });
                    const nextPendingDraft = pendingDraftRef.current as NoteSaveDraft | null;

                    if (nextPendingDraft?.baseUpdatedAt === draft.baseUpdatedAt) {
                        pendingDraftRef.current = {
                            ...nextPendingDraft,
                            baseUpdatedAt: response.saved.updatedAt,
                        };
                        persistCurrentPendingDraft();
                    } else if (!nextPendingDraft) {
                        clearLocalNoteDraft(savedNoteId);
                    }

                    if (!pendingDraftRef.current) {
                        void invalidateQueriesForNoteChange(queryClient);
                    }

                    if (shouldNotifySave) {
                        if (pendingDraftRef.current) {
                            setSaveStatus('pending');
                        } else {
                            setSaveStatus('saved');
                        }
                    }

                    return 'saved';
                };
                const result = executeWriteRef.current
                    ? await executeWriteRef.current(runSaveTransaction)
                    : await runSaveTransaction();

                if (!result) {
                    if (!pendingDraftRef.current) {
                        pendingDraftRef.current = draft;
                    }

                    persistCurrentPendingDraft();
                    inFlightSaveRef.current = false;
                    inFlightSavePromiseRef.current = null;
                    setMountedSaveStatus('pending');
                    return 'idle';
                }

                if (result === 'saved' && (pendingDraftRef.current || flushAfterInFlightRef.current)) {
                    return flushPendingSave({ silent });
                }

                return result;
            })();

            inFlightSavePromiseRef.current = savePromise;

            return savePromise;
        },
        [
            clearSaveTimer,
            editSessionIdRef,
            persistCurrentPendingDraft,
            queryClient,
            serverUpdatedAtRef,
            setMountedSaveStatus,
        ],
    );

    const queueSave = useCallback(
        (draft: NoteSaveDraft, options: { immediate?: boolean } = {}) => {
            pendingDraftRef.current = draft;
            persistCurrentPendingDraft();

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
        [clearSaveTimer, flushPendingSave, persistCurrentPendingDraft, setMountedSaveStatus],
    );

    const restoreLocalDraft = useCallback(
        (draft: NoteSaveDraft) => {
            pendingDraftRef.current = draft;
            persistCurrentPendingDraft();
            setLocalDraft(null);

            if (draft.baseUpdatedAt !== serverUpdatedAtRef.current) {
                setConflict(serverUpdatedAtRef.current);
                return;
            }

            queueSave(draft);
        },
        [persistCurrentPendingDraft, queueSave, setConflict],
    );

    const clearDrafts = useCallback(() => {
        saveGenerationRef.current += 1;
        clearSaveTimer();
        pendingDraftRef.current = null;
        inFlightSaveRef.current = false;
        inFlightSavePromiseRef.current = null;
        flushAfterInFlightRef.current = false;
        isSaveConflictRef.current = false;
        if (noteIdRef.current) clearLocalNoteDraft(noteIdRef.current);
        setLocalDraft(null);
        setSaveStatus('saved');
    }, [clearSaveTimer]);

    const resolveConflict = useCallback(() => {
        clearSaveTimer();
        inFlightSavePromiseRef.current = null;
        flushAfterInFlightRef.current = false;
        isSaveConflictRef.current = false;
        setMountedSaveStatus(pendingDraftRef.current ? 'pending' : 'saved');
    }, [clearSaveTimer, setMountedSaveStatus]);

    const discardLocalDraft = useCallback(() => {
        if (noteIdRef.current) clearLocalNoteDraft(noteIdRef.current);
        setLocalDraft(null);
    }, []);

    const getPendingDraft = useCallback(() => {
        return pendingDraftRef.current;
    }, []);

    const pauseForConflict = useCallback(
        (updatedAt?: string) => {
            clearSaveTimer();
            setConflict(updatedAt);
        },
        [clearSaveTimer, setConflict],
    );

    useEffect(() => {
        beforeSaveRef.current = beforeSave;
        executeWriteRef.current = executeWrite;
        hasExternalPendingChangesRef.current = hasExternalPendingChanges;
        onConflictRef.current = onConflict;
        onErrorRef.current = onError;
        onSavedRef.current = onSaved;
        onCreatedRef.current = onCreated;
        workspaceIdRef.current = workspaceId;
    }, [beforeSave, executeWrite, hasExternalPendingChanges, onConflict, onError, onSaved, onCreated, workspaceId]);

    useEffect(() => {
        isAliveRef.current = true;

        return () => {
            isAliveRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (pendingDraftRef.current || inFlightSaveRef.current || isSaveConflictRef.current) {
            return;
        }

        serverUpdatedAtRef.current = initialUpdatedAt;
        setSaveStatus('saved');
    }, [initialUpdatedAt]);

    useEffect(() => {
        noteIdRef.current = noteId;

        if (noteId !== null && noteId === createdNoteIdRef.current) {
            // Keep edits typed while the first save was creating this note.
            return;
        }

        saveGenerationRef.current += 1;
        pendingDraftRef.current = null;
        inFlightSaveRef.current = false;
        inFlightSavePromiseRef.current = null;
        flushAfterInFlightRef.current = false;
        isSaveConflictRef.current = false;
        serverUpdatedAtRef.current = initialUpdatedAt;
        setLocalDraft(noteId ? readLocalNoteDraft(noteId) : null);
        setSaveStatus('saved');
    }, [noteId]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (
                !pendingDraftRef.current &&
                !inFlightSaveRef.current &&
                !isSaveConflictRef.current &&
                !hasExternalPendingChangesRef.current?.()
            ) {
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

    return {
        saveStatus,
        localDraft,
        serverUpdatedAtRef,
        hasUnsavedChanges: saveStatus !== 'saved',
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
    };
}
