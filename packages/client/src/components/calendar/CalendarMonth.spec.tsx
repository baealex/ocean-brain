import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { CalendarMonth } from './CalendarMonth';
import type { CalendarDayData } from './types';

const days = [
    {
        key: '2026-4-1',
        year: 2026,
        month: 4,
        day: 1,
        isCurrentMonth: true,
        isSunday: false,
        isToday: false,
        isPast: false,
        notes: [],
        reminders: [],
    },
    {
        key: '2026-4-2',
        year: 2026,
        month: 4,
        day: 2,
        isCurrentMonth: true,
        isSunday: false,
        isToday: false,
        isPast: false,
        notes: [],
        reminders: [],
    },
] as CalendarDayData[];

const CalendarMonthHarness = () => {
    const [selectedDayKey, setSelectedDayKey] = useState<string | undefined>('2026-4-1');

    return (
        <CalendarMonth
            days={days}
            type="create"
            isLoading={false}
            selectedDayKey={selectedDayKey}
            onSelectedDayChange={setSelectedDayKey}
        />
    );
};

describe('<CalendarMonth />', () => {
    it('renders the month dates immediately while activity is loading', () => {
        render(
            <CalendarMonth
                days={days}
                type="create"
                isLoading
                selectedDayKey="2026-4-1"
                onSelectedDayChange={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('button', {
                name: 'Wednesday, April 1, 2026, 0 notes, 0 reminders',
            }),
        ).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Month overview' })).toHaveAttribute('aria-busy', 'true');
    });

    it('updates the focused detail when a date is selected', async () => {
        const user = userEvent.setup();

        render(<CalendarMonthHarness />);

        await user.click(
            screen.getByRole('button', {
                name: 'Thursday, April 2, 2026, 0 notes, 0 reminders',
            }),
        );

        const dialog = screen.getByRole('dialog');

        expect(within(dialog).getByRole('heading', { name: 'Thursday, April 2' })).toBeInTheDocument();
    });
});
