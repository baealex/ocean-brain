import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Button, Modal } from '~/components/shared';

import type { Reminder } from '~/models/reminder.model';

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (date: Date, priority: 'low' | 'medium' | 'high', content?: string) => void;
    reminder?: Reminder;
    mode: 'create' | 'edit';
}

export default function ReminderModal({
 isOpen,
 onClose,
 onSave,
 reminder,
 mode
}: ReminderModalProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [reminderPriority, setReminderPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [reminderContent, setReminderContent] = useState<string>('');

    // Initialize form with reminder data when editing
    useEffect(() => {
        if (isOpen && mode === 'edit' && reminder) {
            setSelectedDate(new Date(Number(reminder.reminderDate)));
            setReminderPriority(reminder.priority || 'medium');
            setReminderContent(reminder.content || '');
        } else if (isOpen && mode === 'create') {
            setSelectedDate(new Date());
            setReminderPriority('medium');
            setReminderContent('');
        }
    }, [isOpen, mode, reminder]);

    const handleSave = () => {
        onSave(selectedDate, reminderPriority, reminderContent || undefined);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <Modal.Header
                title={mode === 'create' ? 'Create Reminder' : 'Edit Reminder'}
                onClose={onClose}
            />
            <Modal.Body>
                <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300">
                            Date & Time
                        </label>
                        <input
                            type="datetime-local"
                            className="p-2 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 w-full"
                            value={dayjs(selectedDate).format('YYYY-MM-DDTHH:mm')}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300">
                            Content
                        </label>
                        <textarea
                            className="p-2 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 min-h-[80px] sm:min-h-[100px] resize-none w-full"
                            placeholder="Enter reminder content (optional)"
                            value={reminderContent}
                            onChange={(e) => setReminderContent(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300">
                            Priority
                        </label>
                        <div className="flex gap-1.5 sm:gap-2">
                            <button
                                onClick={() => setReminderPriority('low')}
                                className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                                    reminderPriority === 'low'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-2 border-green-500'
                                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-300 border-2 border-transparent'
                                }`}>
                                Low
                            </button>
                            <button
                                onClick={() => setReminderPriority('medium')}
                                className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                                    reminderPriority === 'medium'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-2 border-yellow-500'
                                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-300 border-2 border-transparent'
                                }`}>
                                Medium
                            </button>
                            <button
                                onClick={() => setReminderPriority('high')}
                                className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                                    reminderPriority === 'high'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-2 border-red-500'
                                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-300 border-2 border-transparent'
                                }`}>
                                High
                            </button>
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} className="bg-gray-200 dark:bg-zinc-700 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        {mode === 'create' ? 'Create' : 'Save'}
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
}
