import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { fetchNotePropertyKeys } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import { fetchViewSectionNotes, fetchViewWorkspace, reorderViewSections, reorderViewTabs } from '~/apis/view.api';
import { ConfirmProvider, ToastProvider } from '~/components/ui';
import { createQueryClientWrapper } from '~/test/test-utils';

import Views from './Views';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

vi.mock('~/apis/note.api', () => ({ fetchNotePropertyKeys: vi.fn() }));
vi.mock('~/apis/tag.api', () => ({ fetchTags: vi.fn() }));
vi.mock('~/apis/view.api', () => ({
    createViewSection: vi.fn(),
    createViewTab: vi.fn(),
    deleteViewSection: vi.fn(),
    deleteViewTab: vi.fn(),
    fetchViewWorkspace: vi.fn(),
    fetchViewSectionNotes: vi.fn(),
    reorderViewSections: vi.fn(),
    reorderViewTabs: vi.fn(),
    setActiveViewTab: vi.fn(),
    updateViewSection: vi.fn(),
    updateViewTab: vi.fn(),
}));

describe('<Views />', () => {
    beforeEach(() => {
        vi.mocked(fetchNotePropertyKeys).mockResolvedValue({
            type: 'success',
            notePropertyKeys: {
                totalCount: 0,
                keys: [],
            },
        } as never);
        vi.mocked(fetchTags).mockResolvedValue({
            type: 'success',
            allTags: {
                totalCount: 0,
                tags: [],
            },
        } as never);
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: {
                activeTabId: null,
                tabs: [],
            },
        } as never);
    });

    it('renders the first-tab onboarding when there are no saved views', async () => {
        const { Wrapper: QueryWrapper } = createQueryClientWrapper();
        const Wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryWrapper>
                <ToastProvider>
                    <ConfirmProvider>{children}</ConfirmProvider>
                </ToastProvider>
            </QueryWrapper>
        );

        render(<Views />, { wrapper: Wrapper });

        expect(await screen.findByText('Create your first view tab')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create first tab' })).toBeInTheDocument();
    });

    it('offers menu fallbacks for moving tabs and sections without dragging', async () => {
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: {
                activeTabId: 'tab-1',
                tabs: [
                    {
                        id: 'tab-1',
                        title: 'Work',
                        order: 0,
                        sections: [
                            {
                                id: 'section-1',
                                tabId: 'tab-1',
                                title: 'First section',
                                displayType: 'list',
                                displayOptions: { tableColumns: ['title'] },
                                tagNames: [],
                                mode: 'and',
                                propertyFilters: [],
                                sortBy: 'updatedAt',
                                sortOrder: 'desc',
                                limit: 5,
                                order: 0,
                            },
                            {
                                id: 'section-2',
                                tabId: 'tab-1',
                                title: 'Second section',
                                displayType: 'list',
                                displayOptions: { tableColumns: ['title'] },
                                tagNames: [],
                                mode: 'and',
                                propertyFilters: [],
                                sortBy: 'updatedAt',
                                sortOrder: 'desc',
                                limit: 5,
                                order: 1,
                            },
                        ],
                    },
                    {
                        id: 'tab-2',
                        title: 'Later',
                        order: 1,
                        sections: [],
                    },
                ],
            },
        } as never);
        vi.mocked(fetchViewSectionNotes).mockResolvedValue({
            type: 'success',
            viewSectionNotes: { totalCount: 0, notes: [] },
        } as never);
        vi.mocked(reorderViewSections).mockResolvedValue({ type: 'success', reorderViewSections: [] } as never);
        vi.mocked(reorderViewTabs).mockResolvedValue({ type: 'success', reorderViewTabs: [] } as never);
        const { Wrapper: QueryWrapper } = createQueryClientWrapper();
        const Wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryWrapper>
                <ToastProvider>
                    <ConfirmProvider>{children}</ConfirmProvider>
                </ToastProvider>
            </QueryWrapper>
        );

        render(<Views />, { wrapper: Wrapper });

        const actionButtons = await screen.findAllByRole('button', { name: 'Section actions' });
        await userEvent.click(actionButtons[0]);
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Move down' }));

        await waitFor(() => {
            expect(reorderViewSections).toHaveBeenCalledWith('tab-1', ['section-2', 'section-1']);
        });

        await userEvent.click(screen.getByRole('button', { name: 'View tab actions' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Move tab right' }));

        await waitFor(() => {
            expect(reorderViewTabs).toHaveBeenCalledWith(['tab-2', 'tab-1']);
        });
    });
});
