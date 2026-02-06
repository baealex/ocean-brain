import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Button, Modal } from '~/components/shared';
import {
    Input,
    Label,
    Textarea,
    ToggleGroup,
    ToggleGroupItem
} from '~/components/ui';

import type { Reminder } from '~/models/reminder.model';

type Priority = 'low' | 'medium' | 'high';

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (date: Date, priority: Priority, content?: string) => void;
    reminder?: Reminder;
    mode: 'create' | 'edit';
}

const priorityStyles: Record<Priority, { active: string; inactive: string }> = {
    low: {
        active: 'bg-pastel-green-200 text-zinc-800 border-2 border-zinc-800 shadow-sketchy',
        inactive: 'bg-pastel-lavender-200/30 text-zinc-700 dark:text-zinc-300 border-2 border-transparent'
    },
    medium: {
        active: 'bg-pastel-yellow-200 text-zinc-800 border-2 border-zinc-800 shadow-sketchy',
        inactive: 'bg-pastel-lavender-200/30 text-zinc-700 dark:text-zinc-300 border-2 border-transparent'
    },
    high: {
        active: 'bg-pastel-pink-200 text-zinc-800 border-2 border-zinc-800 shadow-sketchy',
        inactive: 'bg-pastel-lavender-200/30 text-zinc-700 dark:text-zinc-300 border-2 border-transparent'
    }
};

export default function ReminderModal({
    isOpen,
    onClose,
    onSave,
    reminder,
    mode
}: ReminderModalProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [reminderPriority, setReminderPriority] = useState<Priority>('medium');
    const [reminderContent, setReminderContent] = useState<string>('');

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

    const getPriorityClassName = (priority: Priority) => {
        return reminderPriority === priority
            ? priorityStyles[priority].active
            : priorityStyles[priority].inactive;
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
                        <Label>Date & Time</Label>
                        <Input
                            type="datetime-local"
                            size="sm"
                            value={dayjs(selectedDate).format('YYYY-MM-DDTHH:mm')}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Content</Label>
                        <Textarea
                            size="sm"
                            placeholder="Enter reminder content (optional)"
                            value={reminderContent}
                            onChange={(e) => setReminderContent(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Priority</Label>
                        <ToggleGroup
                            type="single"
                            value={reminderPriority}
                            onValueChange={(value: string) => value && setReminderPriority(value as Priority)}
                            className="border-none gap-1.5 sm:gap-2">
                            <ToggleGroupItem
                                value="low"
                                className={`flex-1 rounded-[8px_3px_9px_2px/3px_6px_3px_7px] font-bold ${getPriorityClassName('low')}`}>
                                Low
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="medium"
                                className={`flex-1 rounded-[8px_3px_9px_2px/3px_6px_3px_7px] font-bold ${getPriorityClassName('medium')}`}>
                                Medium
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="high"
                                className={`flex-1 rounded-[8px_3px_9px_2px/3px_6px_3px_7px] font-bold ${getPriorityClassName('high')}`}>
                                High
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                        {mode === 'create' ? 'Create' : 'Save'}
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
}
