import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '~/components/ui';

import { createReminder, updateReminder, deleteReminder } from '~/apis/reminder.api';
import type { ReminderPriority } from '~/models/reminder.model';
import { queryKeys } from '~/modules/query-key-factory';

export default function useReminderMutate() {
    const toast = useToast();
    const queryClient = useQueryClient();

    const onCreate = useCallback(async (noteId: string, reminderDate: Date, priority: ReminderPriority = 'medium', onSuccess?: () => void, content?: string) => {
        const response = await createReminder({
            noteId,
            reminderDate,
            priority,
            content
        });

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.noteAllPages(noteId),
                exact: false
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.upcomingAllPages(),
                exact: false
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.inDateRangeAll(),
                exact: false
            })
        ]);

        if (onSuccess) {
            onSuccess();
        }
    }, [queryClient, toast]);

    const onUpdate = useCallback(async (id: string, noteId: string, params: {
        reminderDate?: Date;
        completed?: boolean;
        priority?: ReminderPriority;
        content?: string;
    }, onSuccess?: () => void) => {
        const response = await updateReminder({
            id,
            ...params
        });

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.noteAllPages(noteId),
                exact: false
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.upcomingAllPages(),
                exact: false
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.inDateRangeAll(),
                exact: false
            })
        ]);

        if (onSuccess) {
            onSuccess();
        }
    }, [queryClient, toast]);

    const onDelete = useCallback(async (id: string, noteId: string, onSuccess?: () => void) => {
        const response = await deleteReminder(id);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.noteAllPages(noteId),
                exact: false
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.upcomingAllPages(),
                exact: false
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.inDateRangeAll(),
                exact: false
            })
        ]);

        if (onSuccess) {
            onSuccess();
        }
    }, [queryClient, toast]);

    return {
        onCreate,
        onUpdate,
        onDelete
    };
}
