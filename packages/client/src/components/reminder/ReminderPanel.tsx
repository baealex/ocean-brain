import classNames from 'classnames';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Reminders } from '~/components/entities';
import * as Icon from '~/components/icon';
import { AuxiliaryPanel, Button, Dropdown } from '~/components/shared';
import { Checkbox, MoreButton, Text } from '~/components/ui';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import type { Reminder, ReminderPriority } from '~/models/reminder.model';
import { priorityColors } from '~/modules/color';
import ReminderModal from './ReminderModal';
import { formatReminderTimeRemaining, isReminderOverdue } from './reminder-time';

const PRIORITY_LABELS: Record<ReminderPriority, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
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

interface ReminderRowProps {
    reminder: Reminder;
    readOnly: boolean;
    onToggleComplete: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function ReminderRow({ reminder, readOnly, onToggleComplete, onEdit, onDelete }: ReminderRowProps) {
    const reminderTime = Number(reminder.reminderDate);
    const reminderDateText = formatReminderDate(reminder.reminderDate);
    const priority = reminder.priority ?? 'low';
    const showsDateInMeta = Boolean(reminder.content);
    const showsTimeRemaining = !reminder.completed;

    return (
        <div className="flex items-start gap-2.5 px-2 py-1.5 sm:items-center">
            <span className="flex h-[1.6rem] shrink-0 items-center">
                <Checkbox
                    disabled={readOnly}
                    checked={reminder.completed}
                    onChange={onToggleComplete}
                    size="sm"
                    aria-label={`Reminder: ${reminder.content || reminderDateText}`}
                />
            </span>
            {/* Phones stack the details under the content so the content keeps the full row width. */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                <Text
                    as="div"
                    variant="body"
                    weight="medium"
                    className={classNames(
                        'min-w-0 truncate sm:flex-1',
                        reminder.completed && 'line-through opacity-40',
                    )}
                >
                    {reminder.content || reminderDateText}
                </Text>
                <div
                    className={classNames(
                        'flex flex-wrap items-center gap-x-3 gap-y-0.5 sm:shrink-0',
                        reminder.completed && 'opacity-40',
                    )}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            aria-hidden="true"
                            className={`h-2.5 w-2.5 shrink-0 rounded-full border border-border-subtle ${priorityColors[priority]}`}
                        />
                        <Text as="span" variant="label" weight="medium" tone="secondary">
                            {PRIORITY_LABELS[priority]}
                        </Text>
                        <span className="sr-only">priority</span>
                    </span>
                    {(showsDateInMeta || showsTimeRemaining) && (
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {showsDateInMeta && (
                                <Text as="span" variant="meta" tone="secondary" className="whitespace-nowrap">
                                    {reminderDateText}
                                </Text>
                            )}
                            {showsTimeRemaining && (
                                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                                    {showsDateInMeta && (
                                        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border-secondary" />
                                    )}
                                    <Text
                                        as="span"
                                        variant="label"
                                        weight="medium"
                                        tone={isReminderOverdue(reminderTime) ? 'error' : 'tertiary'}
                                    >
                                        {formatReminderTimeRemaining(reminderTime)}
                                    </Text>
                                </span>
                            )}
                        </span>
                    )}
                </div>
            </div>
            <Dropdown
                button={<MoreButton label="Reminder actions" disabled={readOnly} />}
                items={[
                    { name: 'Edit', onClick: onEdit },
                    { name: 'Delete', onClick: onDelete },
                ]}
            />
        </div>
    );
}

interface ReminderPanelProps {
    readOnly?: boolean;
    noteId: string;
}

export default function ReminderPanel({ noteId, readOnly = false }: ReminderPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);
    const { onCreate, onUpdate, onDelete } = useReminderMutate();

    const handleOpenCreateModal = () => {
        setIsCollapsed(false);
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

    return (
        <>
            <AuxiliaryPanel
                title="Reminders"
                icon={<Icon.Bell className="h-3.5 w-3.5" />}
                action={
                    <>
                        {!readOnly && (
                            <Button type="button" size="sm" variant="subtle" onClick={handleOpenCreateModal}>
                                <Icon.Plus className="h-3.5 w-3.5" />
                                Add
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={isCollapsed ? 'Expand reminders' : 'Collapse reminders'}
                            title={isCollapsed ? 'Expand reminders' : 'Collapse reminders'}
                            aria-expanded={!isCollapsed}
                            onClick={() => setIsCollapsed(!isCollapsed)}
                        >
                            {isCollapsed ? (
                                <Icon.TriangleRight className="h-3.5 w-3.5" />
                            ) : (
                                <Icon.TriangleDown className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    </>
                }
            >
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
                                            {reminders.map((reminder) => (
                                                <ReminderRow
                                                    key={reminder.id}
                                                    reminder={reminder}
                                                    readOnly={readOnly}
                                                    onToggleComplete={() => handleToggleComplete(reminder)}
                                                    onEdit={() => handleOpenEditModal(reminder)}
                                                    onDelete={() => onDelete(reminder.id, noteId)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }}
                    />
                )}
            </AuxiliaryPanel>
            <ReminderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveReminder}
                reminder={editingReminder}
                mode={modalMode}
            />
        </>
    );
}
