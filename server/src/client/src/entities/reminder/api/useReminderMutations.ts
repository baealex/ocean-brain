import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createReminder, updateReminder, deleteReminder } from './reminder.api';
import type { ReminderPriority } from '../model/reminder.model';

export const useReminderCreate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createReminder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['noteReminders'] });
            queryClient.invalidateQueries({ queryKey: ['upcomingReminders'] });
        }
    });
};

export const useReminderUpdate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateReminder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['noteReminders'] });
            queryClient.invalidateQueries({ queryKey: ['upcomingReminders'] });
        }
    });
};

export const useReminderDelete = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteReminder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['noteReminders'] });
            queryClient.invalidateQueries({ queryKey: ['upcomingReminders'] });
        }
    });
};
