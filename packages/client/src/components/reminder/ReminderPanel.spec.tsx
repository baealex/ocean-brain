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
    totalCount: 0,
};

vi.mock('~/components/icon', () => ({
    Bell: () => <span aria-hidden="true">Bell</span>,
    Close: () => <span aria-hidden="true">Close</span>,
    TriangleRight: () => <span aria-hidden="true">TriangleRight</span>,
    TriangleDown: () => <span aria-hidden="true">TriangleDown</span>,
    Plus: () => <span aria-hidden="true">Plus</span>,
    VerticalDots: () => <span aria-hidden="true">VerticalDots</span>,
}));

vi.mock('~/components/shared', async () => {
    const actual = await vi.importActual<object>('~/components/shared');

    return {
        ...actual,
        Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
            <button type="button" {...props}>
                {children}
            </button>
        ),
        Dropdown: ({ button }: { button: React.ReactNode }) => <div>{button}</div>,
    };
});

vi.mock('~/components/ui', async () => {
    const actual = await vi.importActual<object>('~/components/ui');
    return {
        ...actual,
        Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input type="checkbox" {...props} />,
    };
});

vi.mock('~/components/entities', () => ({
    Reminders: ({ render }: { render: (data: MockReminderRenderData) => React.ReactNode }) => (
        <>{render(mockReminderData)}</>
    ),
}));

vi.mock('~/hooks/resource/useReminderMutate', () => ({
    default: () => ({
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
    }),
}));

describe('<ReminderPanel />', () => {
    beforeEach(() => {
        mockReminderData = {
            reminders: [],
            totalCount: 0,
        };
    });

    it('shows no reminders panel for a note without reminders', () => {
        render(<ReminderPanel noteId="note-1" />);

        expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument();
    });

    it('opens the reminder form when the note asks to add a reminder', async () => {
        render(<ReminderPanel noteId="note-1" addRequest={1} />);

        expect(await screen.findByRole('dialog', { name: 'Create Reminder' })).toBeInTheDocument();
    });

    it('renders reminder rows when reminders exist', () => {
        mockReminderData = {
            reminders: [
                {
                    id: 'reminder-1',
                    noteId: 'note-1',
                    reminderDate: String(Date.now() + 60_000),
                    completed: false,
                    content: 'Follow up',
                },
            ],
            totalCount: 1,
        };

        render(<ReminderPanel noteId="note-1" />);

        expect(screen.getByText('Follow up')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Reminder: Follow up' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reminder actions' })).toBeInTheDocument();
    });

    it('shows the reminder priority as a text label', () => {
        mockReminderData = {
            reminders: [
                {
                    id: 'reminder-1',
                    noteId: 'note-1',
                    reminderDate: String(Date.now() + 2 * 24 * 60 * 60 * 1000),
                    completed: false,
                    priority: 'high',
                    content: 'Follow up',
                },
            ],
            totalCount: 1,
        };

        render(<ReminderPanel noteId="note-1" />);

        expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('shows multi-day time remaining in days', () => {
        const twoDaysThreeHoursAhead = Date.now() + (2 * 24 + 3) * 60 * 60 * 1000 + 30_000;
        mockReminderData = {
            reminders: [
                {
                    id: 'reminder-1',
                    noteId: 'note-1',
                    reminderDate: String(twoDaysThreeHoursAhead),
                    completed: false,
                    priority: 'low',
                    content: 'Follow up',
                },
            ],
            totalCount: 1,
        };

        render(<ReminderPanel noteId="note-1" />);

        expect(screen.getByText('2d 3h remaining')).toBeInTheDocument();
    });
});
