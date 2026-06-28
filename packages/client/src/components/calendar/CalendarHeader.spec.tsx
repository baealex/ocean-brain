import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CalendarHeader } from './CalendarHeader';

describe('<CalendarHeader />', () => {
    it('labels icon-only month navigation buttons', async () => {
        const user = userEvent.setup();
        const handlePrevMonth = vi.fn();
        const handleNextMonth = vi.fn();

        render(
            <CalendarHeader
                month={6}
                year={2026}
                type="create"
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onToday={vi.fn()}
                onTypeChange={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Previous month' }));
        await user.click(screen.getByRole('button', { name: 'Next month' }));

        expect(handlePrevMonth).toHaveBeenCalledTimes(1);
        expect(handleNextMonth).toHaveBeenCalledTimes(1);
    });
});
