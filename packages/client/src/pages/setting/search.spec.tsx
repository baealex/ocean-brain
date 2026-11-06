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

const defaultInputFormat = {
    queryTemplate: '{query}',
    documentTemplate: 'Title: {title}\nContent: {content}',
    inputSuffix: '',
};

const defaultConfig: SemanticSearchConfig = {
    enabled: false,
    baseUrl: '',
    model: '',
    ...defaultInputFormat,
};

const embeddingModel = 'text-embedding-qwen3-embedding-0.6b';

beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
        hasPointerCapture: { configurable: true, value: () => false },
        setPointerCapture: { configurable: true, value: () => undefined },
        releasePointerCapture: { configurable: true, value: () => undefined },
        scrollIntoView: { configurable: true, value: () => undefined },
    });
});

const createStatus = (overrides: Partial<SearchAdminStatus> = {}): SearchAdminStatus => ({
    config: defaultConfig,
    connectionValidated: false,
    apiKeyConfigured: false,
    phase: 'disabled',
    available: false,
    needsReindex: false,
    noteCount: 0,
    chunkCount: 0,
    indexedAt: null,
    dimensions: null,
    pendingNoteCount: 0,
    lastSyncedAt: null,
    syncError: null,
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

const discoverSingleModel = async (user: ReturnType<typeof userEvent.setup>, apiKey?: string) => {
    const baseUrlInput = await screen.findByLabelText('API base URL');
    await waitFor(() => expect(baseUrlInput).toBeEnabled());
    await user.type(baseUrlInput, 'http://127.0.0.1:1234/v1');
    if (apiKey) {
        await user.type(screen.getByLabelText('API key (optional)'), apiKey);
    }
    await user.click(screen.getByRole('button', { name: 'Find models' }));

    await waitFor(() => {
        expect(vi.mocked(searchAdminApi.fetchSemanticSearchModels).mock.calls[0]?.[0]).toEqual({
            baseUrl: 'http://127.0.0.1:1234/v1',
            ...(apiKey ? { apiKey } : {}),
        });
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

    it('saves and enables a provider before its connection test', async () => {
        const user = userEvent.setup();
        vi.mocked(searchAdminApi.saveSemanticSearchConfig).mockImplementation(async (input) =>
            createStatus({
                config: {
                    enabled: input.enabled,
                    baseUrl: input.baseUrl,
                    model: input.model,
                    queryTemplate: input.queryTemplate,
                    documentTemplate: input.documentTemplate,
                    inputSuffix: input.inputSuffix,
                },
                apiKeyConfigured: Boolean(input.apiKey),
                connectionValidated: false,
                phase: 'needs-connection',
                needsReindex: false,
            }),
        );

        renderPage();

        expect(await screen.findByRole('switch', { name: 'Meaning search' })).toBeDisabled();
        await discoverSingleModel(user, 'provider-secret');

        const meaningSearchSwitch = screen.getByRole('switch', { name: 'Meaning search' });
        expect(meaningSearchSwitch).toBeEnabled();
        await user.click(meaningSearchSwitch);
        await user.click(screen.getByRole('button', { name: 'Save settings' }));

        await waitFor(() => {
            expect(vi.mocked(searchAdminApi.saveSemanticSearchConfig).mock.calls[0]?.[0]).toEqual({
                enabled: true,
                baseUrl: 'http://127.0.0.1:1234/v1',
                model: embeddingModel,
                ...defaultInputFormat,
                apiKey: 'provider-secret',
            });
        });
        expect(searchAdminApi.testSemanticSearchConnection).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Build search index' })).toBeDisabled();
    });

    it('re-enables a previously saved connection without testing the same model again', async () => {
        const user = userEvent.setup();
        const savedConfig: SemanticSearchConfig = {
            enabled: true,
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: embeddingModel,
            ...defaultInputFormat,
        };

        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(
            createStatus({
                config: savedConfig,
                connectionValidated: true,
                phase: 'ready',
                available: true,
                indexedAt: '2026-07-24T00:00:00.000Z',
                dimensions: 1024,
            }),
        );
        vi.mocked(searchAdminApi.saveSemanticSearchConfig).mockImplementation(async (config) =>
            createStatus({
                config,
                connectionValidated: true,
                phase: config.enabled ? 'ready' : 'disabled',
                available: config.enabled,
                indexedAt: '2026-07-24T00:00:00.000Z',
                dimensions: 1024,
            }),
        );

        renderPage();

        const meaningSearchSwitch = await screen.findByRole('switch', { name: 'Meaning search' });
        await waitFor(() => expect(meaningSearchSwitch).toBeChecked());
        await user.click(meaningSearchSwitch);
        await user.click(screen.getByRole('button', { name: 'Save settings' }));

        await waitFor(() => expect(meaningSearchSwitch).not.toBeChecked());
        expect(meaningSearchSwitch).toBeEnabled();

        await user.click(meaningSearchSwitch);
        await user.click(screen.getByRole('button', { name: 'Save settings' }));

        await waitFor(() => {
            expect(vi.mocked(searchAdminApi.saveSemanticSearchConfig).mock.calls[1]?.[0]).toEqual(savedConfig);
        });
        expect(searchAdminApi.testSemanticSearchConnection).not.toHaveBeenCalled();
    });

    it('allows enabling a saved provider that has not been tested yet', async () => {
        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(
            createStatus({
                config: {
                    enabled: false,
                    baseUrl: 'http://127.0.0.1:1234/v1',
                    model: embeddingModel,
                    ...defaultInputFormat,
                },
                connectionValidated: false,
            }),
        );

        renderPage();

        await waitFor(() => {
            expect(screen.getByLabelText('API base URL')).toHaveValue('http://127.0.0.1:1234/v1');
        });
        expect(screen.getByRole('switch', { name: 'Meaning search' })).toBeEnabled();
        expect(screen.getByText('You can save this provider now and test it when you are ready.')).toBeInTheDocument();
    });

    it('marks the form as unsaved after turning on meaning search', async () => {
        const user = userEvent.setup();
        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(
            createStatus({
                config: {
                    enabled: false,
                    baseUrl: 'http://127.0.0.1:1234/v1',
                    model: embeddingModel,
                    ...defaultInputFormat,
                },
            }),
        );
        renderPage();
        const meaningSearchSwitch = await screen.findByRole('switch', { name: 'Meaning search' });
        await waitFor(() => expect(meaningSearchSwitch).toBeEnabled());

        await user.click(meaningSearchSwitch);

        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });

    it('warns without blocking a remote plain HTTP provider', async () => {
        const user = userEvent.setup();
        renderPage();

        const baseUrlInput = await screen.findByLabelText('API base URL');
        await waitFor(() => expect(baseUrlInput).toBeEnabled());
        await user.type(baseUrlInput, 'http://192.168.1.20:1234/v1');

        expect(
            screen.getByText(
                'This provider uses unencrypted HTTP. API credentials and note text can be read on the network.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Find models' })).toBeEnabled();
    });

    it('shows a saved API key without returning its value or provider-specific setup guides', async () => {
        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(createStatus({ apiKeyConfigured: true }));

        renderPage();

        const apiKeyInput = await screen.findByLabelText('API key (optional)');
        await waitFor(() => expect(apiKeyInput).toHaveAttribute('placeholder', 'Saved API key'));
        expect(screen.queryByText('provider-secret')).not.toBeInTheDocument();
        expect(screen.queryByText(/LM Studio|Docker/)).not.toBeInTheDocument();
    });

    it('shows queued note synchronization without offering a full index rebuild', async () => {
        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(
            createStatus({
                config: {
                    enabled: true,
                    baseUrl: 'http://127.0.0.1:1234/v1',
                    model: embeddingModel,
                    ...defaultInputFormat,
                },
                connectionValidated: true,
                phase: 'ready',
                available: true,
                noteCount: 3,
                chunkCount: 5,
                indexedAt: '2026-07-25T00:00:00.000Z',
                dimensions: 1024,
                pendingNoteCount: 2,
                lastSyncedAt: '2026-07-25T00:00:00.000Z',
            }),
        );

        renderPage();

        expect(await screen.findByText(/2 notes are waiting to sync/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Index is up to date' })).toBeDisabled();
        expect(screen.queryByText(/Build the index once/)).not.toBeInTheDocument();
    });
    it('fills the input format from a model preset and saves it', async () => {
        const user = userEvent.setup();
        vi.mocked(searchAdminApi.saveSemanticSearchConfig).mockImplementation(async (input) =>
            createStatus({
                config: {
                    enabled: input.enabled,
                    baseUrl: input.baseUrl,
                    model: input.model,
                    queryTemplate: input.queryTemplate,
                    documentTemplate: input.documentTemplate,
                    inputSuffix: input.inputSuffix,
                },
            }),
        );

        renderPage();

        await user.click(await screen.findByText('Advanced input format'));
        const presetSelect = screen.getByRole('combobox', { name: 'Model preset' });
        await waitFor(() => expect(presetSelect).toBeEnabled());
        await user.click(presetSelect);
        await user.click(await screen.findByRole('option', { name: 'EmbeddingGemma' }));

        expect(screen.getByLabelText('Query template')).toHaveValue('task: search result | query: {query}');
        expect(screen.getByLabelText('Document template')).toHaveValue('title: {title} | text: {content}');

        await user.click(screen.getByRole('button', { name: 'Save settings' }));

        await waitFor(() => {
            expect(vi.mocked(searchAdminApi.saveSemanticSearchConfig).mock.calls[0]?.[0]).toMatchObject({
                queryTemplate: 'task: search result | query: {query}',
                documentTemplate: 'title: {title} | text: {content}',
                inputSuffix: '',
            });
        });
        expect(screen.getByRole('combobox', { name: 'Model preset' })).toHaveTextContent('EmbeddingGemma');
    });
});
