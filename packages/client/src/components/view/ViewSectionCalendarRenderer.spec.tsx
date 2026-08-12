import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { fetchViewSectionCalendarNotes } from '~/apis/view.api';
import type { ViewSection } from '~/models/view.model';
import type { ViewSectionRouteState } from '~/modules/view-route-state';
import { createQueryClientWrapper } from '~/test/test-utils';
import ViewSectionCalendarRenderer from './ViewSectionCalendarRenderer';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, params }: { children: ReactNode; params?: { id?: string } }) => (
        <a href={`/notes/${params?.id ?? ''}`}>{children}</a>
    ),
}));

vi.mock('~/apis/view.api', () => ({
    fetchViewSectionCalendarNotes: vi.fn(),
}));

const createSection = (): ViewSection => ({
    id: 'section-1',
    tabId: 'tab-1',
    title: 'Recently edited',
    displayType: 'calendar',
    displayOptions: {
        tableColumns: ['title'],
        tablePropertyKeys: [],
        boardGroupByPropertyKey: null,
        calendarDateField: 'updatedAt',
    },
    tagNames: ['@ocean'],
    mode: 'and',
    propertyFilters: [],
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 5,
    order: 0,
});

const renderCalendar = (onNavigationStateChange = vi.fn()) => {
    const { Wrapper } = createQueryClientWrapper();

    render(
        <ViewSectionCalendarRenderer
            section={createSection()}
            navigationState={{ calendar: { year: 2026, month: 8 } }}
            onNavigationStateChange={onNavigationStateChange}
        />,
        { wrapper: Wrapper },
    );

    return { onNavigationStateChange };
};

describe('<ViewSectionCalendarRenderer />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchViewSectionCalendarNotes).mockResolvedValue({
            type: 'success',
            viewSectionCalendarNotes: [
                {
                    id: 'note-1',
                    title: 'Edited note',
                    createdAt: String(new Date(2026, 6, 1, 9).getTime()),
                    updatedAt: String(new Date(2026, 7, 12, 9, 30).getTime()),
                },
            ],
        } as never);
    });

    it('opens matching notes from their configured calendar day', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await waitFor(() => {
            expect(fetchViewSectionCalendarNotes).toHaveBeenCalledWith('section-1', {
                start: new Date(2026, 7, 1).toISOString(),
                end: new Date(2026, 8, 1).toISOString(),
            });
        });

        const dayButton = await screen.findByRole('button', {
            name: 'Wednesday, August 12, 2026, 1 note',
        });
        await user.click(dayButton);

        expect(await screen.findByRole('link', { name: /Edited note/ })).toBeInTheDocument();
        expect(screen.getByText('1 matching note')).toBeInTheDocument();
    });

    it('stores month navigation in the owning section URL state', async () => {
        const user = userEvent.setup();
        const { onNavigationStateChange } = renderCalendar();

        await user.click(screen.getByRole('button', { name: 'Next month' }));

        const updater = onNavigationStateChange.mock.calls[0]?.[0] as (
            current: ViewSectionRouteState,
        ) => ViewSectionRouteState;
        expect(updater({})).toEqual({ calendar: { year: 2026, month: 9 } });
    });

    it('renders a retry state when the calendar query fails', async () => {
        vi.mocked(fetchViewSectionCalendarNotes).mockResolvedValue({
            type: 'error',
            errors: [{ message: 'Failed' }],
        } as never);

        renderCalendar();

        expect(await screen.findByText('Failed to load this calendar')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
});
