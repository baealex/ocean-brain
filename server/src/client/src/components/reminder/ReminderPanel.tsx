import { useState } from 'react';
import dayjs from 'dayjs';
import { Button, Dropdown, Progress } from '~/components/shared';
import * as Icon from '~/components/icon';

import { Reminders } from '~/components/entities';
import useReminderMutate from '~/hooks/resource/useReminderMutate';

import type { Reminder } from '~/models/reminder.model';

import styles from './ReminderPanel.module.scss';

interface ReminderPanelProps {
    noteId: string;
}

export default function ReminderPanel({ noteId }: ReminderPanelProps) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [reminderPriority, setReminderPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [reminderContent, setReminderContent] = useState<string>('');
    const [showCompletedReminders, setShowCompletedReminders] = useState(false);
    const { onCreate, onUpdate, onDelete } = useReminderMutate();

    const handleAddReminder = () => {
        onCreate(noteId, selectedDate, reminderPriority, () => {
            setShowDatePicker(false);
            setReminderContent('');
        }, reminderContent || undefined);
    };

    const handleToggleComplete = (reminder: Reminder) => {
        onUpdate(reminder.id, noteId, { completed: !reminder.completed });
    };

    const formatReminderDate = (dateString: string) => {
        const date = dayjs(Number(dateString));
        const now = dayjs();

        if (date.isSame(now, 'day')) {
            return `Today at ${date.format('HH:mm')}`;
        } else if (date.isSame(now.add(1, 'day'), 'day')) {
            return `Tomorrow at ${date.format('HH:mm')}`;
        } else {
            return date.format('YYYY-MM-DD HH:mm');
        }
    };

    const calculateUrgency = (dateString: string) => {
        const date = dayjs(Number(dateString));
        const now = dayjs();
        const diffHours = date.diff(now, 'hour');

        if (diffHours <= 6) return 'high';
        if (diffHours <= 24) return 'medium';
        return 'low';
    };

    const getTimeRemaining = (dateString: string) => {
        const date = dayjs(Number(dateString));
        const now = dayjs();
        const diffHours = date.diff(now, 'hour');
        const diffMinutes = date.diff(now, 'minute') % 60;

        if (diffHours < 0 || diffMinutes < 0) return 'Overdue';
        if (diffHours === 0) return `${diffMinutes}m remaining`;
        return `${diffHours}h ${diffMinutes}m remaining`;
    };

    return (
        <div className="shadow-xl p-5 rounded-2xl mb-5">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <p className="text-lg font-bold">Reminders</p>
                    <button
                        onClick={() => setShowCompletedReminders(!showCompletedReminders)}
                        className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors">
                        {showCompletedReminders ? 'Hide Completed' : 'Show Completed'}
                    </button>
                </div>
                <Button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="flex items-center gap-1">
                    <Icon.Plus className="w-4 h-4" />
                    <span>Add Reminder</span>
                </Button>
            </div>

            {showDatePicker && (
                <div className="mb-4 p-3 border border-gray-200 dark:border-zinc-700 rounded-lg">
                    <div className="flex flex-col gap-3">
                        <input
                            type="datetime-local"
                            className="p-2 border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                            value={dayjs(selectedDate).format('YYYY-MM-DDTHH:mm')}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        />
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-gray-600 dark:text-zinc-400">내용:</p>
                            <textarea
                                className="p-2 border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 min-h-[80px] resize-none"
                                placeholder="리마인더 내용을 입력하세요"
                                value={reminderContent}
                                onChange={(e) => setReminderContent(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-gray-600 dark:text-zinc-400">Priority:</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setReminderPriority('low')}
                                    className={`flex-1 py-1 px-3 rounded-md text-sm ${reminderPriority === 'low'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-300'}`}>
                                    Low
                                </button>
                                <button
                                    onClick={() => setReminderPriority('medium')}
                                    className={`flex-1 py-1 px-3 rounded-md text-sm ${reminderPriority === 'medium'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-300'}`}>
                                    Medium
                                </button>
                                <button
                                    onClick={() => setReminderPriority('high')}
                                    className={`flex-1 py-1 px-3 rounded-md text-sm ${reminderPriority === 'high'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-300'}`}>
                                    High
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setShowDatePicker(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddReminder}>
                                Add
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Reminders
                noteId={noteId}
                searchParams={{
                    offset: 0,
                    limit: 10
                }}
                render={({ reminders, totalCount }) => {
                    const filteredReminders = showCompletedReminders
                        ? reminders
                        : reminders.filter(r => !r.completed);

                    const completedCount = reminders.filter(r => r.completed).length;

                    return (
                        <div className="flex flex-col gap-3">
                            {totalCount > 0 && (
                                <div className="mb-1">
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
                                        <span>Progress</span>
                                        <span>{completedCount} of {totalCount} completed</span>
                                    </div>
                                    <Progress value={completedCount} max={totalCount} />
                                </div>
                            )}

                            {filteredReminders.length === 0 ? (
                                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                                    {totalCount === 0 ? 'No reminders set for this note.' : 'No incomplete reminders.'}
                                </p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {filteredReminders.map((reminder) => {
                                        const urgency = reminder.priority || calculateUrgency(reminder.reminderDate);
                                        const timeRemaining = getTimeRemaining(reminder.reminderDate);

                                        const urgencyColors: Record<string, string> = {
                                            low: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
                                            medium: 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20',
                                            high: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                                        };

                                        return (
                                            <div
                                                key={reminder.id}
                                                className={`flex flex-col p-3 border rounded-lg transition-all ${reminder.completed
                                                    ? 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'
                                                    : urgencyColors[urgency]}`}>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={reminder.completed}
                                                            onChange={() => handleToggleComplete(reminder)}
                                                            className="w-4 h-4 cursor-pointer"
                                                        />
                                                        <span className={`font-medium ${reminder.completed ? 'line-through' : ''}`}>
                                                            {formatReminderDate(reminder.reminderDate)}
                                                        </span>
                                                    </div>
                                                    <Dropdown
                                                        button={<Icon.VerticalDots className="w-4 h-4" />}
                                                        items={[
                                                            {
                                                                name: 'Delete',
                                                                onClick: () => onDelete(reminder.id, noteId)
                                                            }
                                                        ]}
                                                    />
                                                </div>

                                                {!reminder.completed && (
                                                    <div className="mt-2 ml-6 text-xs">
                                                        <span className={`${styles.pulsingText} ${urgency === 'high' ? styles.urgent : ''}`}>
                                                            {timeRemaining}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                }}
            />
        </div>
    );
}
