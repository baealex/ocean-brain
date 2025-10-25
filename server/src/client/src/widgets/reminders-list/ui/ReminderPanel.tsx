import { useState } from 'react';
import dayjs from 'dayjs';
import { Button, Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';

import { Reminders } from '~/components/entities';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import ReminderModal from './ReminderModal';

import type { Reminder } from '~/models/reminder.model';

import styles from './ReminderPanel.module.scss';

interface ReminderPanelProps {
    noteId: string;
}

export default function ReminderPanel({ noteId }: ReminderPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);
    const { onCreate, onUpdate, onDelete } = useReminderMutate();

    const handleOpenCreateModal = () => {
        setModalMode('create');
        setEditingReminder(undefined);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (reminder: Reminder) => {
        setModalMode('edit');
        setEditingReminder(reminder);
        setIsModalOpen(true);
    };

    const handleSaveReminder = (date: Date, priority: 'low' | 'medium' | 'high', content?: string) => {
        if (modalMode === 'create') {
            onCreate(noteId, date, priority, () => {
                setIsModalOpen(false);
            }, content);
        } else if (modalMode === 'edit' && editingReminder) {
            onUpdate(editingReminder.id, noteId, {
                reminderDate: date,
                priority,
                content
            }, () => {
                setIsModalOpen(false);
            });
        }
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
        <div className="shadow-xl p-3 sm:p-5 rounded-2xl mb-5">
            <div className="flex justify-between items-center mb-3">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                    {isCollapsed ? (
                        <Icon.TriangleRight className="w-3 h-3" />
                    ) : (
                        <Icon.TriangleDown className="w-3 h-3" />
                    )}
                    <p className="text-base sm:text-lg font-bold">Reminders</p>
                </button>
                {!isCollapsed && (
                    <Button
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-1 text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2">
                        <Icon.Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Add Reminder</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                )}
            </div>

            {!isCollapsed && (

            <Reminders
                noteId={noteId}
                searchParams={{
                    offset: 0,
                    limit: 9999
                }}
                render={({ reminders, totalCount }) => {
                    return (
                        <div className="flex flex-col gap-3">
                            {reminders.length === 0 ? (
                                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                                    {totalCount === 0 ? 'No reminders set for this note.' : 'No incomplete reminders.'}
                                </p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {reminders.map((reminder) => {
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
                                                className={`flex flex-col p-2 sm:p-3 border rounded-lg transition-all ${reminder.completed
                                                    ? 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'
                                                    : urgencyColors[urgency]}`}>
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={reminder.completed}
                                                            onChange={() => handleToggleComplete(reminder)}
                                                            className="w-4 h-4 cursor-pointer mt-0.5 flex-shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`font-medium text-sm sm:text-base ${reminder.completed ? 'line-through' : ''}`}>
                                                                {formatReminderDate(reminder.reminderDate)}
                                                            </div>
                                                            {reminder.content && (
                                                                <div className={`mt-1 text-xs sm:text-sm text-gray-700 dark:text-zinc-300 ${reminder.completed ? 'line-through' : ''} break-words`}>
                                                                    {reminder.content}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Dropdown
                                                        button={<Icon.VerticalDots className="w-4 h-4 flex-shrink-0" />}
                                                        items={[
                                                            {
                                                                name: 'Edit',
                                                                onClick: () => handleOpenEditModal(reminder)
                                                            },
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
            )}

            <ReminderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveReminder}
                reminder={editingReminder}
                mode={modalMode}
            />
        </div>
    );
}
