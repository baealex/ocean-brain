import { useBlocker } from '@tanstack/react-router';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';
import type { NoteSaveFlushResult, NoteSaveStatus } from './useNoteSaveController';

interface UseNoteNavigationGuardParams {
    allowNextNavigationRef: MutableRefObject<boolean>;
    hasExternalPendingChanges: boolean;
    saveStatus: NoteSaveStatus;
    flushPendingChanges: () => Promise<NoteSaveFlushResult>;
    notify: (message: string) => void;
}

export function useNoteNavigationGuard({
    allowNextNavigationRef,
    hasExternalPendingChanges,
    saveStatus,
    flushPendingChanges,
    notify,
}: UseNoteNavigationGuardParams) {
    const shouldBlockNavigation = useCallback(async () => {
        if (allowNextNavigationRef.current) {
            allowNextNavigationRef.current = false;
            return false;
        }

        if (saveStatus === 'conflict') {
            notify('Resolve the note conflict before leaving.');
            return true;
        }

        const result = await flushPendingChanges();

        if (result === 'error') {
            notify('Save failed. Stay on this note and try again.');
            return true;
        }

        return result === 'conflict';
    }, [allowNextNavigationRef, flushPendingChanges, notify, saveStatus]);

    useBlocker({
        disabled: saveStatus === 'saved' && !hasExternalPendingChanges,
        enableBeforeUnload: false,
        shouldBlockFn: shouldBlockNavigation,
    });
}
