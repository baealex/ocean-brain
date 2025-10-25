import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@baejino/ui';

import { createReminder, updateReminder, deleteReminder } from '~/apis/reminder.api';
import type { ReminderPriority } from '~/models/reminder.model';

export default function useReminderMutate() {
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

        queryClient.invalidateQueries({ queryKey: ['noteReminders', noteId] });
        queryClient.invalidateQueries({ queryKey: ['upcomingReminders'] });

        if (onSuccess) {
            onSuccess();
        }
    }, [queryClient]);

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

        queryClient.invalidateQueries({ queryKey: ['noteReminders', noteId] });
        queryClient.invalidateQueries({ queryKey: ['upcomingReminders'] });

        if (onSuccess) {
            onSuccess();
        }
    }, [queryClient]);

    const onDelete = useCallback(async (id: string, noteId: string, onSuccess?: () => void) => {
        const response = await deleteReminder(id);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        queryClient.invalidateQueries({ queryKey: ['noteReminders', noteId] });
        queryClient.invalidateQueries({ queryKey: ['upcomingReminders'] });

        if (onSuccess) {
            onSuccess();
        }
    }, [queryClient]);

    return {
        onCreate,
        onUpdate,
        onDelete
    };
}
