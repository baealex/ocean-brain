import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
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

const createSection = (patch: Partial<ViewSection> = {}): ViewSection => ({
    id: 'section-1',
    tabId: 'tab-1',
    title: 'Recently edited',
    displayType: 'calendar',
    displayOptions: {
        tableColumns: ['title'],
        tablePropertyKeys: [],
        boardGroupByPropertyKey: null,
        calendarDateField: 'updatedAt',
        calendarDatePropertyKey: null,
    },
    tagNames: ['@ocean'],
    mode: 'and',
    propertyFilters: [],
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 5,
    order: 0,
    ...patch,
});

const renderCalendar = (
    onNavigationStateChange = vi.fn(),
    section = createSection(),
    calendarDateProperty?: ComponentProps<typeof ViewSectionCalendarRenderer>['calendarDateProperty'],
) => {
    const { Wrapper } = createQueryClientWrapper();

    render(
        <ViewSectionCalendarRenderer
            section={section}
            calendarDateProperty={calendarDateProperty}
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
                    calendarDate: String(new Date(2026, 7, 12, 9, 30).getTime()),
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
        expect(dayButton).toHaveClass('min-h-20');
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

    it('places date properties on their saved day without timezone shifting', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchViewSectionCalendarNotes).mockResolvedValue({
            type: 'success',
            viewSectionCalendarNotes: [{ id: 'note-1', title: 'Due note', calendarDate: '2026-08-12' }],
        } as never);
        const section = createSection({
            displayOptions: {
                ...createSection().displayOptions,
                calendarDateField: 'property',
                calendarDatePropertyKey: 'due-date',
            },
        });

        renderCalendar(vi.fn(), section, {
            key: 'due-date',
            name: 'Due date',
            valueType: 'date',
            noteCount: 1,
            options: [],
            updatedAt: '2026-08-01T00:00:00.000Z',
        });

        await waitFor(() => {
            expect(fetchViewSectionCalendarNotes).toHaveBeenCalledWith('section-1', {
                start: '2026-08-01T00:00:00.000Z',
                end: '2026-09-01T00:00:00.000Z',
            });
        });

        expect(screen.getByText('Notes placed by due date')).toBeInTheDocument();
        await user.click(
            await screen.findByRole('button', {
                name: 'Wednesday, August 12, 2026, 1 note',
            }),
        );
        expect(await screen.findByRole('link', { name: /Due note/ })).toBeInTheDocument();
        expect(screen.queryByText('00:00')).not.toBeInTheDocument();
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
