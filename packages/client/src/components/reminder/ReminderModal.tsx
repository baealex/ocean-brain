import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Button, Modal, ModalActionRow } from '~/components/shared';
import {
    Input,
    Label,
    Text,
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
        active: 'border-border-secondary bg-elevated text-fg-default',
        inactive: 'border-transparent bg-transparent text-fg-muted hover:bg-hover-subtle'
    },
    medium: {
        active: 'border-border-secondary bg-elevated text-fg-default',
        inactive: 'border-transparent bg-transparent text-fg-muted hover:bg-hover-subtle'
    },
    high: {
        active: 'border-border-secondary bg-elevated text-fg-default',
        inactive: 'border-transparent bg-transparent text-fg-muted hover:bg-hover-subtle'
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
                            className="gap-1.5 border-none rounded-[14px] bg-muted/70 p-1 sm:gap-2">
                            <ToggleGroupItem
                                value="low"
                                className={`flex-1 rounded-[10px] border ${getPriorityClassName('low')}`}>
                                <Text as="span" weight="medium" className="text-current">
                                    Low
                                </Text>
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="medium"
                                className={`flex-1 rounded-[10px] border ${getPriorityClassName('medium')}`}>
                                <Text as="span" weight="medium" className="text-current">
                                    Medium
                                </Text>
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="high"
                                className={`flex-1 rounded-[10px] border ${getPriorityClassName('high')}`}>
                                <Text as="span" weight="medium" className="text-current">
                                    High
                                </Text>
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave}>
                        {mode === 'create' ? 'Create' : 'Save'}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
