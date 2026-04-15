import { render, screen } from '@testing-library/react';

import { fetchTags } from '~/apis/tag.api';
import { fetchViewWorkspace } from '~/apis/view.api';
import { ConfirmProvider, ToastProvider } from '~/components/ui';
import { createQueryClientWrapper } from '~/test/test-utils';

import Views from './Views';

vi.mock('~/apis/tag.api', () => ({ fetchTags: vi.fn() }));
vi.mock('~/apis/view.api', () => ({
    createViewSection: vi.fn(),
    createViewTab: vi.fn(),
    deleteViewSection: vi.fn(),
    deleteViewTab: vi.fn(),
    fetchViewWorkspace: vi.fn(),
    reorderViewSections: vi.fn(),
    reorderViewTabs: vi.fn(),
    setActiveViewTab: vi.fn(),
    updateViewSection: vi.fn(),
    updateViewTab: vi.fn(),
}));

describe('<Views />', () => {
    beforeEach(() => {
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
});
