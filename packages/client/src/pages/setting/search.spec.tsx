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
    connectionValidated: false,
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

    it('requires a connection test before first activation and then saves the enabled search', async () => {
        const user = userEvent.setup();
        vi.mocked(searchAdminApi.saveSemanticSearchConfig).mockImplementation(async (config) =>
            createStatus({
                config,
                connectionValidated: true,
                phase: 'needs-index',
                needsReindex: true,
            }),
        );

        renderPage();

        expect(await screen.findByRole('switch', { name: 'Meaning search' })).toBeDisabled();
        await discoverSingleModel(user);

        expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Test selected model' }));

        await waitFor(() => {
            expect(vi.mocked(searchAdminApi.testSemanticSearchConnection).mock.calls[0]?.[0]).toEqual({
                ...defaultConfig,
                baseUrl: 'http://127.0.0.1:1234/v1',
                model: embeddingModel,
            });
        });
        const meaningSearchSwitch = screen.getByRole('switch', { name: 'Meaning search' });
        expect(meaningSearchSwitch).toBeEnabled();
        await user.click(meaningSearchSwitch);
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
    });

    it('re-enables a previously saved connection without testing the same model again', async () => {
        const user = userEvent.setup();
        const savedConfig: SemanticSearchConfig = {
            enabled: true,
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: embeddingModel,
            queryInstruction: '',
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

    it('does not trust a connection that was only saved while meaning search was disabled', async () => {
        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(
            createStatus({
                config: {
                    enabled: false,
                    baseUrl: 'http://127.0.0.1:1234/v1',
                    model: embeddingModel,
                    queryInstruction: '',
                },
                connectionValidated: false,
            }),
        );

        renderPage();

        await waitFor(() => {
            expect(screen.getByLabelText('API base URL')).toHaveValue('http://127.0.0.1:1234/v1');
        });
        expect(screen.getByRole('switch', { name: 'Meaning search' })).toBeDisabled();
        expect(screen.getByText('Test the selected model first.')).toBeInTheDocument();
    });

    it('shows queued note synchronization without offering a full index rebuild', async () => {
        vi.mocked(searchAdminApi.fetchSearchAdminStatus).mockResolvedValue(
            createStatus({
                config: {
                    enabled: true,
                    baseUrl: 'http://127.0.0.1:1234/v1',
                    model: embeddingModel,
                    queryInstruction: '',
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
});
