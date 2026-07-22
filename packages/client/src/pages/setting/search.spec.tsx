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
    fetchSemanticSearchModels: vi.fn(),
    saveSemanticSearchConfig: vi.fn(),
    startSemanticSearchReindex: vi.fn(),
    testSemanticSearchConnection: vi.fn(),
}));

const defaultConfig: SemanticSearchConfig = {
    enabled: false,
    baseUrl: '',
    model: '',
    queryInstruction: '',
};

const embeddingModel = 'text-embedding-qwen3-embedding-0.6b';

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

const discoverSingleModel = async (user: ReturnType<typeof userEvent.setup>) => {
    const baseUrlInput = await screen.findByLabelText('API base URL');
    await waitFor(() => expect(baseUrlInput).toBeEnabled());
    await user.type(baseUrlInput, 'http://127.0.0.1:1234/v1');
    await user.click(screen.getByRole('button', { name: 'Find models' }));

    await waitFor(() => {
        expect(vi.mocked(searchAdminApi.fetchSemanticSearchModels).mock.calls[0]?.[0]).toBe('http://127.0.0.1:1234/v1');
        expect(screen.getByRole('combobox', { name: 'Embedding model' })).toHaveTextContent(embeddingModel);
    });
};

describe('<SearchSetting />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(createStatus());
        vi.mocked(searchAdminApi.fetchSemanticSearchModels).mockResolvedValue({
            models: [{ id: embeddingModel, likelyEmbedding: true }],
        });
        vi.mocked(searchAdminApi.testSemanticSearchConnection).mockResolvedValue({
            dimensions: 1024,
            model: embeddingModel,
        });
    });

    it('presents setup in API, model, activation order and keeps the query instruction optional', async () => {
        const user = userEvent.setup();
        renderPage();

        expect(await screen.findByLabelText('API base URL')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Connect an embedding API' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Choose and test a model' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Turn on meaning search' })).toBeInTheDocument();
        expect(screen.getByText(/keyword search works without this index/i)).toBeInTheDocument();

        const instruction = screen.getByLabelText('Query instruction');
        expect(instruction).not.toBeVisible();
        await user.click(screen.getByText('Advanced query instruction'));
        expect(instruction).toBeVisible();
        expect(instruction).toHaveValue('');

        await user.click(screen.getByRole('button', { name: 'Use personal-note preset' }));
        expect(instruction).toHaveValue(
            'Given a vague Korean memory query, retrieve relevant passages from personal notes.',
        );
        expect(screen.getByText(/Personal-note preset/)).toBeInTheDocument();
        expect(screen.getByText(/changing it does not require rebuilding the index/i)).toBeInTheDocument();
    });

    it('discovers a model before testing the selected embedding endpoint', async () => {
        const user = userEvent.setup();
        renderPage();

        expect(await screen.findByRole('switch', { name: 'Meaning search' })).toBeDisabled();
        await discoverSingleModel(user);

        expect(await screen.findByText('API connected. Found 1 model.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Test selected model' }));

        await waitFor(() => {
            expect(vi.mocked(searchAdminApi.testSemanticSearchConnection).mock.calls[0]?.[0]).toEqual({
                ...defaultConfig,
                baseUrl: 'http://127.0.0.1:1234/v1',
                model: embeddingModel,
            });
        });
        expect(await screen.findByText('This model works · 1024 dimensions')).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Meaning search' })).toBeEnabled();
    });

    it('enables and saves meaning search only after the selected model passes its test', async () => {
        const user = userEvent.setup();
        vi.mocked(searchAdminApi.saveSemanticSearchConfig).mockImplementation(async (config) =>
            createStatus({
                config,
                phase: 'needs-index',
                needsReindex: true,
            }),
        );

        renderPage();
        await discoverSingleModel(user);
        await user.click(screen.getByRole('button', { name: 'Test selected model' }));
        await screen.findByText('This model works · 1024 dimensions');
        await user.click(screen.getByRole('switch', { name: 'Meaning search' }));
        await user.click(screen.getByRole('button', { name: 'Save settings' }));

        await waitFor(() => {
            expect(vi.mocked(searchAdminApi.saveSemanticSearchConfig).mock.calls[0]?.[0]).toEqual({
                enabled: true,
                baseUrl: 'http://127.0.0.1:1234/v1',
                model: embeddingModel,
                queryInstruction: '',
            });
        });
        expect(screen.getByRole('button', { name: 'Build search index' })).toBeEnabled();
        expect(await screen.findByText('Index needed')).toBeInTheDocument();
    });
});
