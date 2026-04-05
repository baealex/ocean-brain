import { render, screen } from '@testing-library/react';

import ReminderPanel from './ReminderPanel';

type MockReminder = {
    id: string;
    noteId: string;
    reminderDate: string;
    completed: boolean;
    priority?: 'low' | 'medium' | 'high';
    content?: string;
};

type MockReminderRenderData = {
    reminders: MockReminder[];
    totalCount: number;
};

let mockReminderData: MockReminderRenderData = {
    reminders: [],
    totalCount: 0
};

vi.mock('~/components/icon', () => ({
    TriangleRight: () => <span>TriangleRight</span>,
    TriangleDown: () => <span>TriangleDown</span>,
    Plus: () => <span>Plus</span>,
    VerticalDots: () => <span>VerticalDots</span>
}));

vi.mock('~/components/shared', () => ({
    Button: ({
        children,
        onClick
    }: {
        children: React.ReactNode;
        onClick?: () => void;
    }) => <button type="button" onClick={onClick}>{children}</button>,
    Dropdown: ({ button }: { button: React.ReactNode }) => <div>{button}</div>,
    Empty: ({
        title,
        description,
        className = ''
    }: {
        title?: string;
        description?: string;
        className?: string;
    }) => (
        <div data-testid="empty-state" className={className}>
            <div>{title}</div>
            <div>{description}</div>
        </div>
    )
}));

vi.mock('~/components/ui', () => ({ Checkbox: () => <button type="button">Checkbox</button> }));

vi.mock('~/components/entities', () => ({
    Reminders: ({ render }: { render: (data: MockReminderRenderData) => React.ReactNode }) => (
        <>{render(mockReminderData)}</>
    )
}));

vi.mock('~/hooks/resource/useReminderMutate', () => ({
    default: () => ({
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn()
    })
}));

vi.mock('./ReminderModal', () => ({ default: () => null }));

describe('<ReminderPanel />', () => {
    beforeEach(() => {
        mockReminderData = {
            reminders: [],
            totalCount: 0
        };
    });

    it('renders an empty state when a note has no reminders', () => {
        render(<ReminderPanel noteId="note-1" />);

        expect(screen.getByText('No reminders yet')).toBeInTheDocument();
    });

    it('renders reminder rows instead of the empty state when reminders exist', () => {
        mockReminderData = {
            reminders: [
                {
                    id: 'reminder-1',
                    noteId: 'note-1',
                    reminderDate: String(Date.now() + 60_000),
                    completed: false,
                    content: 'Follow up'
                }
            ],
            totalCount: 1
        };

        render(<ReminderPanel noteId="note-1" />);

        expect(screen.queryByText('No reminders yet')).not.toBeInTheDocument();
        expect(screen.getByText('Follow up')).toBeInTheDocument();
    });
});
