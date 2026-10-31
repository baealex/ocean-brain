import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { updateNoteProperties, updateNotePropertyKey } from '~/apis/note.api';
import { fetchViewBoardColumn } from '~/apis/view.api';
import { ToastProvider } from '~/components/ui';
import type { NoteProperty } from '~/models/note.model';
import type { View } from '~/models/view.model';
import type { ViewNavigationState, ViewRouteStateUpdater } from '~/modules/view-route-state';
import { createQueryClientWrapper } from '~/test/test-utils';
import ViewBoardRenderer from './ViewBoardRenderer';

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => vi.fn(),
    Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock('~/apis/note.api', () => ({ updateNoteProperties: vi.fn(), updateNotePropertyKey: vi.fn() }));
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

const createNoteProperty = (
    patch: Partial<NoteProperty> & Pick<NoteProperty, 'key' | 'name' | 'value'>,
): NoteProperty => ({
    valueType: 'select',
    option: null,
    createdAt: '1785679200000',
    updatedAt: '1785679200000',
    ...patch,
});

const badgeNote = {
    id: 'note-1',
    title: 'Badge task',
    tags: [{ id: 'tag-1', name: '@product' }],
    createdAt: '1785679200000',
    updatedAt: '1785679200000',
    properties: [
        createNoteProperty({ key: 'status', name: 'Status', value: 'todo', option: statusProperty.options[0] }),
        createNoteProperty({
            key: 'project',
            name: 'Project',
            value: 'ocean-brain',
            option: { id: 'ocean-brain', label: 'Ocean Brain', value: 'ocean-brain', color: '#3b82f6', order: 0 },
        }),
        createNoteProperty({ key: 'due', name: 'Due', value: '2026-11-01', valueType: 'date' }),
    ],
};

const renderBadgeBoard = (displayOptions: Partial<View['displayOptions']>) => {
    vi.mocked(fetchViewBoardColumn).mockImplementation(async (_id, { optionValue }) => ({
        type: 'success',
        viewBoardColumn: optionValue === 'todo' ? { totalCount: 1, notes: [badgeNote] } : { totalCount: 0, notes: [] },
    }));
    const { Wrapper: QueryWrapper } = createQueryClientWrapper();
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryWrapper>
            <ToastProvider>{children}</ToastProvider>
        </QueryWrapper>
    );

    render(
        <ViewBoardRenderer
            view={{ ...view, displayOptions: { ...view.displayOptions, ...displayOptions } }}
            groupProperty={statusProperty}
            readOnly
        />,
        { wrapper: Wrapper },
    );
};

const renderEditableBoard = () => {
    vi.mocked(fetchViewBoardColumn).mockResolvedValue({
        type: 'success',
        viewBoardColumn: { totalCount: 0, notes: [] },
    });
    const { Wrapper: QueryWrapper } = createQueryClientWrapper();
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryWrapper>
            <ToastProvider>{children}</ToastProvider>
        </QueryWrapper>
    );

    render(<ViewBoardRenderer view={view} groupProperty={statusProperty} />, { wrapper: Wrapper });
};

const getColumnOrder = () =>
    screen
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label'))
        .filter((label): label is string => Boolean(label?.endsWith(' column')));

describe('<ViewBoardRenderer />', () => {
    it('shows cards without move controls when embedded in a read-only note', async () => {
        vi.mocked(fetchViewBoardColumn).mockImplementation(async (_id, { optionValue }) => ({
            type: 'success',
            viewBoardColumn:
                optionValue === 'todo'
                    ? {
                          totalCount: 1,
                          notes: [
                              {
                                  id: 'note-1',
                                  title: 'Read-only task',
                                  tags: [],
                                  createdAt: '1785679200000',
                                  updatedAt: '1785679200000',
                              },
                          ],
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
        expect(screen.queryByRole('button', { name: 'Reorder To do column' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Actions for To do column' })).not.toBeInTheDocument();
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
                          notes: [
                              {
                                  id: 'note-1',
                                  title: 'Ocean task',
                                  tags: [],
                                  createdAt: '1785679200000',
                                  updatedAt: '1785679200000',
                              },
                          ],
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
                                  ? [
                                        {
                                            id: 'note-1',
                                            title: 'First task',
                                            tags: [],
                                            createdAt: '1785679200000',
                                            updatedAt: '1785679200000',
                                        },
                                    ]
                                  : [
                                        {
                                            id: 'note-2',
                                            title: 'Second task',
                                            tags: [],
                                            createdAt: '1785679201000',
                                            updatedAt: '1785679201000',
                                        },
                                    ],
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
    it('shows the view card fields and leaves the column property out of the card', async () => {
        renderBadgeBoard({ tableColumns: ['title', 'tags', 'properties'], tablePropertyKeys: [] });

        const card = await screen.findByRole('article');
        expect(within(card).getByText('Badge task')).toBeInTheDocument();
        expect(within(card).getByText('@product')).toBeInTheDocument();
        expect(within(card).getByText('Ocean Brain')).toBeInTheDocument();
        expect(within(card).getByTitle('Due: 2026-11-01')).toBeInTheDocument();
        expect(within(card).queryByText('To do')).not.toBeInTheDocument();
        expect(within(card).queryByText(/Updated/)).not.toBeInTheDocument();
    });

    it('shows only the chosen properties with the selected date fields', async () => {
        renderBadgeBoard({ tableColumns: ['title', 'properties', 'updatedAt'], tablePropertyKeys: ['due'] });

        const card = await screen.findByRole('article');
        expect(within(card).getByTitle('Due: 2026-11-01')).toBeInTheDocument();
        expect(within(card).queryByText('Ocean Brain')).not.toBeInTheDocument();
        expect(within(card).queryByText('@product')).not.toBeInTheDocument();
        expect(within(card).getByText(/^Updated /)).toBeInTheDocument();
    });

    it('hides property badges when the properties field is turned off', async () => {
        renderBadgeBoard({ tableColumns: ['title', 'tags'], tablePropertyKeys: [] });

        const card = await screen.findByRole('article');
        expect(within(card).getByText('@product')).toBeInTheDocument();
        expect(within(card).queryByText('Ocean Brain')).not.toBeInTheDocument();
    });
    it('moves a column from its menu and saves the option order', async () => {
        vi.mocked(updateNotePropertyKey).mockResolvedValue({
            type: 'success',
            updateNotePropertyKey: statusProperty,
        } as never);
        const user = userEvent.setup();
        renderEditableBoard();

        expect(getColumnOrder()).toEqual(['To do column', 'Doing column', 'Unassigned column']);
        expect(screen.queryByRole('button', { name: 'Actions for Unassigned column' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Actions for To do column' }));
        await user.click(screen.getByRole('menuitem', { name: 'Move right' }));

        await waitFor(() =>
            expect(updateNotePropertyKey).toHaveBeenCalledWith({
                key: 'status',
                options: [
                    { id: 'doing', label: 'Doing', value: 'doing', color: '#f0a45d', order: 0 },
                    { id: 'todo', label: 'To do', value: 'todo', color: '#5b8def', order: 1 },
                ],
            }),
        );
        expect(getColumnOrder()).toEqual(['Doing column', 'To do column', 'Unassigned column']);
    });

    it('restores the column order when saving the option order fails', async () => {
        vi.mocked(updateNotePropertyKey).mockResolvedValue({
            type: 'error',
            errors: [{ message: 'Could not save the order.' }],
        } as never);
        const user = userEvent.setup();
        renderEditableBoard();

        await user.click(screen.getByRole('button', { name: 'Actions for Doing column' }));
        await user.click(screen.getByRole('menuitem', { name: 'Move left' }));

        expect(await screen.findByText('Could not save the order.')).toBeInTheDocument();
        expect(getColumnOrder()).toEqual(['To do column', 'Doing column', 'Unassigned column']);
    });
});
