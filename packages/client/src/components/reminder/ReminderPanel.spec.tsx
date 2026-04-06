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
    TriangleRight: () => <span aria-hidden="true">TriangleRight</span>,
    TriangleDown: () => <span aria-hidden="true">TriangleDown</span>,
    Plus: () => <span aria-hidden="true">Plus</span>,
    VerticalDots: () => <span aria-hidden="true">VerticalDots</span>
}));

vi.mock('~/components/shared', async () => {
    const actual = await vi.importActual<object>('~/components/shared');

    return {
        ...actual,
        Button: ({
            children,
            onClick
        }: {
            children: React.ReactNode;
            onClick?: () => void;
        }) => <button type="button" onClick={onClick}>{children}</button>,
        Dropdown: ({ button }: { button: React.ReactNode }) => <div>{button}</div>
    };
});

vi.mock('~/components/ui', async () => {
    const actual = await vi.importActual<object>('~/components/ui');
    return {
        ...actual,
        Checkbox: () => <button type="button" aria-label="reminder checkbox" />
    };
});

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

    it('renders no reminder rows when a note has no reminders', () => {
        render(<ReminderPanel noteId="note-1" />);

        expect(screen.queryByRole('button', { name: 'reminder checkbox' })).not.toBeInTheDocument();
    });

    it('renders reminder rows when reminders exist', () => {
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

        expect(screen.getByRole('button', { name: 'reminder checkbox' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reminder actions' })).toBeInTheDocument();
    });
});
