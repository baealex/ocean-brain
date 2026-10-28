import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { updateNoteProperties } from '~/apis/note.api';
import { fetchViewBoardColumn } from '~/apis/view.api';
import { ToastProvider } from '~/components/ui';
import type { View } from '~/models/view.model';
import type { ViewNavigationState, ViewRouteStateUpdater } from '~/modules/view-route-state';
import { createQueryClientWrapper } from '~/test/test-utils';
import ViewBoardRenderer from './ViewBoardRenderer';

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => vi.fn(),
    Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock('~/apis/note.api', () => ({ updateNoteProperties: vi.fn() }));
vi.mock('~/apis/view.api', () => ({ fetchViewBoardColumn: vi.fn() }));

const view: View = {
    id: 'view-1',
    groupId: 'group-1',
    title: 'Project board',
    displayType: 'board',
    displayOptions: {
        tableColumns: ['title'],
        tablePropertyKeys: [],
        boardGroupByPropertyKey: 'status',
        calendarDateField: 'createdAt',
        calendarDatePropertyKey: null,
    },
    tagNames: [],
    mode: 'and',
    propertyFilters: [],
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 5,
    order: 0,
};

const statusProperty = {
    key: 'status',
    name: 'Status',
    valueType: 'select' as const,
    noteCount: 1,
    updatedAt: '1785679200000',
    options: [
        { id: 'todo', label: 'To do', value: 'todo', color: '#5b8def', order: 0 },
        { id: 'doing', label: 'Doing', value: 'doing', color: '#f0a45d', order: 1 },
    ],
};

describe('<ViewBoardRenderer />', () => {
    it('shows cards without move controls when embedded in a read-only note', async () => {
        vi.mocked(fetchViewBoardColumn).mockImplementation(async (_id, { optionValue }) => ({
            type: 'success',
            viewBoardColumn:
                optionValue === 'todo'
                    ? {
                          totalCount: 1,
                          notes: [{ id: 'note-1', title: 'Read-only task', updatedAt: '1785679200000' }],
                      }
                    : { totalCount: 0, notes: [] },
        }));
        const { Wrapper: QueryWrapper } = createQueryClientWrapper();
        const Wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryWrapper>
                <ToastProvider>{children}</ToastProvider>
            </QueryWrapper>
        );

        render(<ViewBoardRenderer view={view} groupProperty={statusProperty} readOnly />, { wrapper: Wrapper });

        expect(await screen.findByText('Read-only task')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Drag Read-only task/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Move Read-only task' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /New note/ })).not.toBeInTheDocument();
    });

    it('moves a card to another column by updating the grouping property', async () => {
        const user = userEvent.setup();
        let currentOptionValue = 'todo';
        vi.mocked(fetchViewBoardColumn).mockImplementation(async (_id, { optionValue }) => ({
            type: 'success',
            viewBoardColumn:
                optionValue === currentOptionValue
                    ? {
                          totalCount: 1,
                          notes: [{ id: 'note-1', title: 'Ocean task', updatedAt: '1785679200000' }],
                      }
                    : { totalCount: 0, notes: [] },
        }));
        vi.mocked(updateNoteProperties).mockImplementation(async () => {
            currentOptionValue = 'doing';
            return {
                type: 'success',
                updateNoteProperties: { id: 'note-1', updatedAt: '1785679201000', properties: [] },
            };
        });
        const { Wrapper: QueryWrapper } = createQueryClientWrapper();
        const Wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryWrapper>
                <ToastProvider>{children}</ToastProvider>
            </QueryWrapper>
        );

        render(<ViewBoardRenderer view={view} groupProperty={statusProperty} />, { wrapper: Wrapper });

        await user.click(await screen.findByRole('button', { name: 'Move Ocean task' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Move to Doing' }));

        await waitFor(() => {
            expect(updateNoteProperties).toHaveBeenCalledWith({
                id: 'note-1',
                expectedUpdatedAt: '1785679200000',
                set: [
                    {
                        key: 'status',
                        name: 'Status',
                        value: 'doing',
                        valueType: 'select',
                    },
                ],
            });
        });

        const doingColumn = screen.getByRole('region', { name: 'Doing column' });
        await waitFor(() => {
            expect(within(doingColumn).getByText('Ocean task')).toBeInTheDocument();
        });
    });

    it('loads the next board column page on demand', async () => {
        const user = userEvent.setup();
        const pagedView = { ...view, limit: 1 };
        vi.mocked(fetchViewBoardColumn).mockImplementation(async (_id, { optionValue, offset }) => ({
            type: 'success',
            viewBoardColumn:
                optionValue === 'todo'
                    ? {
                          totalCount: 2,
                          notes:
                              offset === 0
                                  ? [{ id: 'note-1', title: 'First task', updatedAt: '1785679200000' }]
                                  : [{ id: 'note-2', title: 'Second task', updatedAt: '1785679201000' }],
                      }
                    : { totalCount: 0, notes: [] },
        }));
        const { Wrapper: QueryWrapper } = createQueryClientWrapper();
        const Wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryWrapper>
                <ToastProvider>{children}</ToastProvider>
            </QueryWrapper>
        );
        const ControlledBoard = () => {
            const [navigationState, setNavigationState] = useState<ViewNavigationState>({});
            const handleNavigationStateChange = (updater: ViewRouteStateUpdater) => {
                setNavigationState((current) => (typeof updater === 'function' ? updater(current) : updater));
            };

            return (
                <ViewBoardRenderer
                    view={pagedView}
                    groupProperty={statusProperty}
                    navigationState={navigationState}
                    onNavigationStateChange={handleNavigationStateChange}
                />
            );
        };

        render(<ControlledBoard />, { wrapper: Wrapper });

        await user.click(await screen.findByRole('button', { name: 'Load more (1)' }));

        expect(await screen.findByText('Second task')).toBeInTheDocument();
        expect(fetchViewBoardColumn).toHaveBeenCalledWith('view-1', {
            optionValue: 'todo',
            limit: 1,
            offset: 1,
        });
    });
});
