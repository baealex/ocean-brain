import { act, renderHook } from '@testing-library/react';

import { createReminder, deleteReminder, updateReminder } from '~/apis/reminder.api';
import { queryKeys } from '~/modules/query-key-factory';
import { createQueryClientWrapper, createTestQueryClient } from '~/test/test-utils';

import useReminderMutate from './useReminderMutate';

const mockToast = vi.fn();

vi.mock('~/apis/reminder.api', () => ({
    createReminder: vi.fn(),
    deleteReminder: vi.fn(),
    updateReminder: vi.fn(),
}));

vi.mock('~/components/ui', () => ({
    useToast: () => mockToast,
}));

const renderReminderMutate = () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const { Wrapper } = createQueryClientWrapper(queryClient);
    const hook = renderHook(() => useReminderMutate(), { wrapper: Wrapper });

    return { ...hook, invalidateSpy };
};

describe('useReminderMutate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a reminder, invalidates reminder queries, and then calls success', async () => {
        vi.mocked(createReminder).mockResolvedValue({ type: 'success' } as never);
        const onSuccess = vi.fn();
        const { result, invalidateSpy } = renderReminderMutate();

        await act(async () => {
            await result.current.onCreate(
                'note-7',
                new Date('2026-08-08T12:30:00.000Z'),
                'high',
                onSuccess,
                'Follow up',
            );
        });

        expect(createReminder).toHaveBeenCalledWith({
            noteId: 'note-7',
            reminderDate: new Date('2026-08-08T12:30:00.000Z'),
            priority: 'high',
            content: 'Follow up',
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: queryKeys.reminders.all(),
            exact: false,
        });
        expect(invalidateSpy.mock.invocationCallOrder[0]).toBeLessThan(onSuccess.mock.invocationCallOrder[0]);
    });

    it('shows the API error without invalidating or calling success', async () => {
        vi.mocked(createReminder).mockResolvedValue({
            type: 'error',
            errors: [{ message: 'Reminder could not be created' }],
        } as never);
        const onSuccess = vi.fn();
        const { result, invalidateSpy } = renderReminderMutate();

        await act(async () => {
            await result.current.onCreate('note-7', new Date('2026-08-08T12:30:00.000Z'), 'medium', onSuccess);
        });

        expect(mockToast).toHaveBeenCalledWith('Reminder could not be created');
        expect(invalidateSpy).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('forwards explicit update fields and invalidates reminder queries', async () => {
        vi.mocked(updateReminder).mockResolvedValue({ type: 'success' } as never);
        const { result, invalidateSpy } = renderReminderMutate();

        await act(async () => {
            await result.current.onUpdate('reminder-3', 'note-7', {
                completed: false,
                content: '',
            });
        });

        expect(updateReminder).toHaveBeenCalledWith({
            id: 'reminder-3',
            completed: false,
            content: '',
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: queryKeys.reminders.all(),
            exact: false,
        });
    });

    it('deletes a reminder and calls success after invalidation', async () => {
        vi.mocked(deleteReminder).mockResolvedValue({ type: 'success' } as never);
        const onSuccess = vi.fn();
        const { result, invalidateSpy } = renderReminderMutate();

        await act(async () => {
            await result.current.onDelete('reminder-3', 'note-7', onSuccess);
        });

        expect(deleteReminder).toHaveBeenCalledWith('reminder-3');
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: queryKeys.reminders.all(),
            exact: false,
        });
        expect(invalidateSpy.mock.invocationCallOrder[0]).toBeLessThan(onSuccess.mock.invocationCallOrder[0]);
    });
});
