import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SearchAdminStatus, SemanticSearchConfig } from '~/apis/search-admin.api';
import * as searchAdminApi from '~/apis/search-admin.api';
import { ToastProvider } from '~/components/ui';
import { createTestQueryClient } from '~/test/test-utils';
import SearchSetting from './search';

vi.mock('~/apis/search-admin.api', () => ({
    fetchSearchAdminStatus: vi.fn(),
    saveSemanticSearchConfig: vi.fn(),
    startSemanticSearchReindex: vi.fn(),
    testSemanticSearchConnection: vi.fn(),
}));

const defaultConfig: SemanticSearchConfig = {
    enabled: false,
    baseUrl: '',
    model: '',
    queryInstruction: 'Given a vague Korean memory query, retrieve relevant passages from personal notes.',
};

const createStatus = (overrides: Partial<SearchAdminStatus> = {}): SearchAdminStatus => ({
    config: defaultConfig,
    phase: 'disabled',
    available: false,
    needsReindex: false,
    noteCount: 0,
    chunkCount: 0,
    indexedAt: null,
    dimensions: null,
    progress: null,
    error: null,
    ...overrides,
});

const renderPage = () => {
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <ToastProvider>
                <SearchSetting />
            </ToastProvider>
        </QueryClientProvider>,
    );
};

describe('<SearchSetting />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(createStatus());
    });

    it('explains where note text goes before semantic search is enabled', async () => {
        renderPage();

        expect(await screen.findByLabelText('API base URL')).toBeInTheDocument();
        expect(screen.getByText(/sends note text to the embedding API/i)).toBeInTheDocument();
        expect(screen.getByText(/keyword search works without this index/i)).toBeInTheDocument();
    });

    it('saves a configured embedding endpoint before enabling index build', async () => {
        const user = userEvent.setup();
        vi.mocked(searchAdminApi.saveSemanticSearchConfig).mockImplementation(async (config) =>
            createStatus({
                config,
                phase: 'needs-index',
                needsReindex: true,
            }),
        );

        renderPage();

        const baseUrlInput = await screen.findByLabelText('API base URL');
        await user.click(screen.getByRole('switch', { name: 'Meaning search' }));
        await user.type(baseUrlInput, 'http://127.0.0.1:1234/v1');
        await user.type(screen.getByLabelText('Model'), 'text-embedding-qwen3-embedding-0.6b');
        await user.click(screen.getByRole('button', { name: 'Save settings' }));

        await waitFor(() => {
            expect(vi.mocked(searchAdminApi.saveSemanticSearchConfig).mock.calls[0]?.[0]).toEqual({
                ...defaultConfig,
                enabled: true,
                baseUrl: 'http://127.0.0.1:1234/v1',
                model: 'text-embedding-qwen3-embedding-0.6b',
            });
        });
        expect(screen.getByRole('button', { name: 'Build search index' })).toBeEnabled();
        expect(await screen.findByText('Index needed')).toBeInTheDocument();
    });
});
