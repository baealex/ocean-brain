import { useState } from 'react';
import dayjs from 'dayjs';
import { Button, Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';
import { Checkbox } from '~/components/ui';

import { Reminders } from '~/components/entities';
import { priorityColorsSubtle } from '~/modules/color';
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
        <div className="p-4 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] mb-5 border-2 border-zinc-800 dark:border-zinc-700 bg-surface/50 dark:bg-surface-dark/50">
            <div className="flex justify-between items-center mb-3">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                    {isCollapsed ? (
                        <Icon.TriangleRight size={14} />
                    ) : (
                        <Icon.TriangleDown size={14} />
                    )}
                    <p className="text-sm font-bold">Reminders</p>
                </button>
                {!isCollapsed && (
                    <Button size="sm" variant="ghost" onClick={handleOpenCreateModal}>
                        <Icon.Plus className="w-3 h-3" />
                        <span className="hidden sm:inline text-xs">Add</span>
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
                            <div className="flex flex-col gap-2">
                                {reminders.length === 0 ? (
                                    <p className="text-zinc-400 dark:text-zinc-500 text-xs">
                                        {totalCount === 0 ? 'No reminders.' : 'No incomplete reminders.'}
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        {reminders.map((reminder) => {
                                            const urgency = reminder.priority || calculateUrgency(reminder.reminderDate);
                                            const timeRemaining = getTimeRemaining(reminder.reminderDate);

                                            return (
                                                <div
                                                    key={reminder.id}
                                                    className={`flex items-start gap-2 p-2 rounded-[10px_3px_11px_3px/3px_8px_3px_10px] transition-colors ${reminder.completed
                                                        ? 'bg-zinc-100 dark:bg-zinc-800'
                                                        : priorityColorsSubtle[urgency]}`}>
                                                    <Checkbox
                                                        checked={reminder.completed}
                                                        onChange={() => handleToggleComplete(reminder)}
                                                        size="sm"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`font-bold text-xs text-zinc-700 dark:text-zinc-300 ${reminder.completed ? 'line-through opacity-50' : ''}`}>
                                                            {formatReminderDate(reminder.reminderDate)}
                                                        </div>
                                                        {reminder.content && (
                                                            <div className={`text-xs text-zinc-500 dark:text-zinc-400 ${reminder.completed ? 'line-through opacity-50' : ''} truncate`}>
                                                                {reminder.content}
                                                            </div>
                                                        )}
                                                        {!reminder.completed && (
                                                            <span className={`text-[10px] font-medium ${styles.pulsingText} ${urgency === 'high' ? styles.urgent : 'text-zinc-400'}`}>
                                                                {timeRemaining}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Dropdown
                                                        button={<Icon.VerticalDots size={14} className="text-zinc-400" />}
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
