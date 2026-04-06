import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getServerCache, setServerCache } from '~/apis/server-cache.api';
import { queryKeys } from '~/modules/query-key-factory';
import { createQueryClientWrapper, createTestQueryClient } from '~/test/test-utils';

import SidebarHeroBanner from './SidebarHeroBanner';

const mockConfirm = vi.fn();
type ThemeState = {
    theme: string;
};

vi.mock('~/apis/server-cache.api', () => ({
    getServerCache: vi.fn(),
    setServerCache: vi.fn()
}));

vi.mock('~/components/ui', async () => {
    const actual = await vi.importActual<object>('~/components/ui');

    return {
        ...actual,
        useConfirm: () => mockConfirm
    };
});

vi.mock('~/store/theme', () => ({ useTheme: (selector: (state: ThemeState) => unknown) => selector({ theme: 'light' }) }));

describe('<SidebarHeroBanner />', () => {
    it('renders the hero image and removes it through the confirm flow', async () => {
        vi.mocked(getServerCache).mockResolvedValue('https://example.com/hero.jpg');
        vi.mocked(setServerCache).mockResolvedValue('' as never);
        mockConfirm.mockResolvedValue(true);

        const queryClient = createTestQueryClient();
        const invalidateSpy = vi
            .spyOn(queryClient, 'invalidateQueries')
            .mockResolvedValue(undefined);
        const { Wrapper } = createQueryClientWrapper(queryClient);

        render(<SidebarHeroBanner />, { wrapper: Wrapper });

        const removeButton = await screen.findByRole('button', { name: 'Remove hero banner' });
        expect(await screen.findByAltText('Studio atmosphere banner')).toBeInTheDocument();
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalledWith('Do you want to remove this hero banner?');
            expect(setServerCache).toHaveBeenCalledWith('heroBanner', '');
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.ui.heroBanner(),
                exact: true
            });
        });
    });
});
