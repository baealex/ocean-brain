import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CalendarDay } from './CalendarDay';

describe('<CalendarDay />', () => {
    it('summarizes the day and selects it from the month overview', async () => {
        const user = userEvent.setup();
        const handleSelect = vi.fn();

        render(
            <CalendarDay
                year={2026}
                month={4}
                day={2}
                isCurrentMonth
                isSunday={false}
                isToday={false}
                isSelected={false}
                isPast={false}
                notes={
                    [
                        { id: 'n1', title: 'Note one' },
                        { id: 'n2', title: 'Note two' },
                    ] as never[]
                }
                reminders={[{ id: 'r1', content: 'Reminder one', completed: true }] as never[]}
                onSelect={handleSelect}
            />,
        );

        const dayButton = screen.getByRole('button', {
            name: 'Thursday, April 2, 2026, 2 notes, 1 reminder',
        });

        expect(dayButton).toHaveAttribute('aria-pressed', 'false');
        expect(dayButton).toHaveClass('min-h-20', 'sm:min-h-24', 'lg:min-h-[142px]');
        expect(screen.getByText('Reminder one')).toHaveClass('line-through');
        expect(screen.getByText('Note one')).toBeInTheDocument();
        expect(screen.getByText('+1 more')).toBeInTheDocument();

        await user.click(dayButton);

        expect(handleSelect).toHaveBeenCalledTimes(1);
    });

    it('keeps adjacent-month dates unavailable in the current month overview', () => {
        render(
            <CalendarDay
                year={2026}
                month={3}
                day={29}
                isCurrentMonth={false}
                isSunday
                isToday={false}
                isSelected={false}
                isPast
                notes={[]}
                reminders={[]}
                onSelect={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('button', {
                name: 'Sunday, March 29, 2026, 0 notes, 0 reminders',
            }),
        ).toBeDisabled();
    });
});
