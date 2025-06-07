import { useState } from 'react';
import dayjs from 'dayjs';
import { Button, Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';

import { Reminders } from '~/components/entities';
import useReminderMutate from '~/hooks/resource/useReminderMutate';

import type { Reminder } from '~/models/reminder.model';

interface ReminderPanelProps {
    noteId: string;
}

export default function ReminderPanel({ noteId }: ReminderPanelProps) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const { onCreate, onUpdate, onDelete } = useReminderMutate();

    const handleAddReminder = () => {
        onCreate(noteId, selectedDate, () => {
            setShowDatePicker(false);
        });
    };

    const handleToggleComplete = (reminder: Reminder) => {
        onUpdate(reminder.id, noteId, { completed: !reminder.completed });
    };

    const formatReminderDate = (dateString: string) => {
        const date = dayjs(dateString);
        const now = dayjs();

        if (date.isSame(now, 'day')) {
            return `Today at ${date.format('HH:mm')}`;
        } else if (date.isSame(now.add(1, 'day'), 'day')) {
            return `Tomorrow at ${date.format('HH:mm')}`;
        } else {
            return date.format('YYYY-MM-DD HH:mm');
        }
    };

    return (
        <div className="shadow-xl p-5 rounded-2xl mb-5">
            <div className="flex justify-between items-center mb-3">
                <p className="text-lg font-bold">Reminders</p>
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
                render={({ reminders }) => (
                    <div className="flex flex-col gap-2">
                        {reminders.length === 0 ? (
                            <p className="text-gray-500 dark:text-zinc-400 text-sm">No reminders set for this note.</p>
                        ) : (
                            reminders.map((reminder) => (
                                <div
                                    key={reminder.id}
                                    className={`flex justify-between items-center p-3 border rounded-lg ${
                                        reminder.completed
                                            ? 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'
                                            : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                    }`}>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={reminder.completed}
                                            onChange={() => handleToggleComplete(reminder)}
                                            className="w-4 h-4 cursor-pointer"
                                        />
                                        <span className={reminder.completed ? 'line-through' : ''}>
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
                            ))
                        )}
                    </div>
                )}
            />
        </div>
    );
}
