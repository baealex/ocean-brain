import classNames from 'classnames';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Reminders } from '~/components/entities';
import * as Icon from '~/components/icon';
import { AuxiliaryPanelHeader, Button, Dropdown } from '~/components/shared';
import { Checkbox, MoreButton, Text } from '~/components/ui';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import type { Reminder } from '~/models/reminder.model';
import ReminderModal from './ReminderModal';

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
            onCreate(
                noteId,
                date,
                priority,
                () => {
                    setIsModalOpen(false);
                },
                content,
            );
        } else if (modalMode === 'edit' && editingReminder) {
            onUpdate(
                editingReminder.id,
                noteId,
                {
                    reminderDate: date,
                    priority,
                    content,
                },
                () => {
                    setIsModalOpen(false);
                },
            );
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
        <div className="surface-base mb-5 p-4">
            <div className={classNames('flex items-center justify-between', !isCollapsed && 'mb-3')}>
                <button
                    type="button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="focus-ring-soft flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-fg-tertiary transition-colors hover:bg-hover-subtle hover:text-fg-default"
                >
                    <AuxiliaryPanelHeader
                        icon={isCollapsed ? <Icon.TriangleRight size={12} /> : <Icon.TriangleDown size={12} />}
                        title="Reminders"
                    />
                </button>
                {!isCollapsed && (
                    <Button size="sm" variant="ghost" onClick={handleOpenCreateModal}>
                        <Icon.Plus className="w-3 h-3" />
                        <Text as="span" variant="label" className="hidden sm:inline">
                            Add
                        </Text>
                    </Button>
                )}
            </div>

            {!isCollapsed && (
                <Reminders
                    noteId={noteId}
                    searchParams={{
                        offset: 0,
                        limit: 9999,
                    }}
                    render={({ reminders, totalCount }) => {
                        return (
                            <div className="flex flex-col gap-2">
                                {reminders.length === 0 ? (
                                    <Text as="p" variant="meta" tone="secondary" className="py-3 text-center">
                                        {totalCount === 0 ? 'No reminders yet' : 'All reminders complete'}
                                    </Text>
                                ) : (
                                    <div className="flex flex-col">
                                        {reminders.map((reminder) => {
                                            const urgency =
                                                reminder.priority || calculateUrgency(reminder.reminderDate);
                                            const timeRemaining = getTimeRemaining(reminder.reminderDate);
                                            const isOverdue = timeRemaining === 'Overdue';

                                            return (
                                                <div
                                                    key={reminder.id}
                                                    className={classNames('flex items-center gap-2.5 px-2 py-1.5')}
                                                >
                                                    <Checkbox
                                                        checked={reminder.completed}
                                                        onChange={() => handleToggleComplete(reminder)}
                                                        size="sm"
                                                    />
                                                    <Text
                                                        as="div"
                                                        variant="body"
                                                        weight="medium"
                                                        className={classNames(
                                                            'truncate flex-1 min-w-0',
                                                            reminder.completed && 'line-through opacity-40',
                                                        )}
                                                    >
                                                        {reminder.content || formatReminderDate(reminder.reminderDate)}
                                                    </Text>
                                                    <div
                                                        className={classNames(
                                                            'shrink-0 flex items-center gap-1',
                                                            reminder.completed && 'opacity-40',
                                                        )}
                                                    >
                                                        {reminder.content && (
                                                            <Text as="span" variant="meta" tone="secondary">
                                                                {formatReminderDate(reminder.reminderDate)}
                                                            </Text>
                                                        )}
                                                        {!reminder.completed && (
                                                            <Text
                                                                as="span"
                                                                variant="label"
                                                                weight="medium"
                                                                tone={
                                                                    isOverdue || urgency === 'high'
                                                                        ? 'error'
                                                                        : 'tertiary'
                                                                }
                                                                className={classNames(
                                                                    reminder.content &&
                                                                        'before:content-["·"] before:mr-1',
                                                                )}
                                                            >
                                                                {timeRemaining}
                                                            </Text>
                                                        )}
                                                    </div>
                                                    <Dropdown
                                                        button={<MoreButton label="Reminder actions" />}
                                                        items={[
                                                            {
                                                                name: 'Edit',
                                                                onClick: () => handleOpenEditModal(reminder),
                                                            },
                                                            {
                                                                name: 'Delete',
                                                                onClick: () => onDelete(reminder.id, noteId),
                                                            },
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
