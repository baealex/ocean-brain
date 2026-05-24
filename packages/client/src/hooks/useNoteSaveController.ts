import { useQueryClient } from '@tanstack/react-query';
import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { updateNote } from '~/apis/note.api';
import {
    clearLocalNoteDraft,
    type NoteSaveDraft,
    readLocalNoteDraft,
    writeLocalNoteDraft,
} from '~/modules/note-draft-storage';
import { queryKeys } from '~/modules/query-key-factory';

const NOTE_AUTOSAVE_DELAY_MS = 1000;
const NOTE_UPDATE_CONFLICT_CODE = 'NOTE_UPDATE_CONFLICT';

export type NoteSaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

interface UseNoteSaveControllerParams {
    noteId: string;
    initialContent: string;
    initialUpdatedAt: string;
    editSessionIdRef: MutableRefObject<string>;
    getContent: () => string | undefined;
    onSaved: (updatedAt: string) => void;
    onConflict: (updatedAt: string) => void;
    onError: (message: string) => void;
}

interface BuildNoteDraftOptions {
    layout?: NoteSaveDraft['layout'];
}

export function useNoteSaveController({
    noteId,
    initialContent,
    initialUpdatedAt,
    editSessionIdRef,
    getContent,
    onSaved,
    onConflict,
    onError,
}: UseNoteSaveControllerParams) {
    const queryClient = useQueryClient();
    const saveTimerRef = useRef<number | null>(null);
    const pendingDraftRef = useRef<NoteSaveDraft | null>(null);
    const inFlightSaveRef = useRef(false);
    const flushAfterInFlightRef = useRef(false);
    const serverUpdatedAtRef = useRef(initialUpdatedAt);
    const isSaveConflictRef = useRef(false);
    const isAliveRef = useRef(true);
    const onSavedRef = useRef(onSaved);
    const onConflictRef = useRef(onConflict);
    const onErrorRef = useRef(onError);

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
        if (pendingDraftRef.current) {
            writeLocalNoteDraft(noteId, pendingDraftRef.current);
        }
    }, [noteId]);

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
                id: noteId,
                title: draft.title,
                content: draft.content,
                ...(draft.layout ? { layout: draft.layout } : {}),
                editSessionId: editSessionIdRef.current,
                ...(ignoreConflict ? { force: true } : { expectedUpdatedAt: draft.baseUpdatedAt }),
            });

            inFlightSaveRef.current = false;

            if (response.type === 'error') {
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

                    return;
                }

                if (!silent && isAliveRef.current) {
                    setMountedSaveStatus('error');
                    onErrorRef.current(error.message);
                }

                return;
            }

            isSaveConflictRef.current = false;
            serverUpdatedAtRef.current = response.updateNote.updatedAt;
            const nextPendingDraft = pendingDraftRef.current as NoteSaveDraft | null;

            if (nextPendingDraft?.baseUpdatedAt === draft.baseUpdatedAt) {
                pendingDraftRef.current = {
                    ...nextPendingDraft,
                    baseUpdatedAt: response.updateNote.updatedAt,
                };
                persistCurrentPendingDraft();
            } else if (!nextPendingDraft) {
                clearLocalNoteDraft(noteId);
            }

            if (!silent && isAliveRef.current) {
                onSavedRef.current(response.updateNote.updatedAt);

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
        [clearSaveTimer, editSessionIdRef, noteId, persistCurrentPendingDraft, queryClient, setMountedSaveStatus],
    );

    const queueSave = useCallback(
        (draft: NoteSaveDraft, options: { immediate?: boolean } = {}) => {
            pendingDraftRef.current = draft;
            writeLocalNoteDraft(noteId, draft);

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
        [clearSaveTimer, flushPendingSave, noteId, setMountedSaveStatus],
    );

    const restoreLocalDraft = useCallback(
        (draft: NoteSaveDraft) => {
            pendingDraftRef.current = draft;
            writeLocalNoteDraft(noteId, draft);
            setLocalDraft(null);

            if (draft.baseUpdatedAt !== serverUpdatedAtRef.current) {
                setConflict(serverUpdatedAtRef.current);
                return;
            }

            queueSave(draft);
        },
        [noteId, queueSave, setConflict],
    );

    const clearDrafts = useCallback(() => {
        clearSaveTimer();
        pendingDraftRef.current = null;
        flushAfterInFlightRef.current = false;
        isSaveConflictRef.current = false;
        clearLocalNoteDraft(noteId);
        setLocalDraft(null);
        setSaveStatus('saved');
    }, [clearSaveTimer, noteId]);

    const discardLocalDraft = useCallback(() => {
        clearLocalNoteDraft(noteId);
        setLocalDraft(null);
    }, [noteId]);

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
        onConflictRef.current = onConflict;
        onErrorRef.current = onError;
        onSavedRef.current = onSaved;
    }, [onConflict, onError, onSaved]);

    useEffect(() => {
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
        pendingDraftRef.current = null;
        inFlightSaveRef.current = false;
        flushAfterInFlightRef.current = false;
        isSaveConflictRef.current = false;
        serverUpdatedAtRef.current = initialUpdatedAt;
        setLocalDraft(readLocalNoteDraft(noteId));
        setSaveStatus('saved');
    }, [noteId]);

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
        pauseForConflict,
        getPendingDraft,
        setServerUpdatedAt,
    };
}
