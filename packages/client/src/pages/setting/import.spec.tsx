import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import * as api from '~/apis/markdown-import.api';
import { ConfirmProvider } from '~/components/ui';
import { createTestQueryClient } from '~/test/test-utils';
import ImportPage from './import';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, params }: { children: ReactNode; params?: { id: string } }) => (
        <a href={`/${params?.id}`}>{children}</a>
    ),
}));
vi.mock('~/apis/markdown-import.api', () => ({
    fetchImportContext: vi.fn(),
    startMarkdownImport: vi.fn(),
    createImportNotes: vi.fn(),
    saveImportNotes: vi.fn(),
    trashImportedNotes: vi.fn(),
}));
vi.mock('~/store/workspace', () => ({
    useWorkspace: () => ({
        workspaceId: '1',
        workspaces: [
            { id: '1', name: 'First', archivedAt: null },
            { id: '2', name: 'Second', archivedAt: null },
        ],
    }),
}));

const file = (path: string, text: string) => {
    const bytes = new TextEncoder().encode(text);
    const result = new File([text], path, { type: 'text/markdown' });
    Object.defineProperty(result, 'arrayBuffer', { value: async () => bytes.buffer });
    return result;
};
const renderPage = () =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <ConfirmProvider>
                <ImportPage />
            </ConfirmProvider>
        </QueryClientProvider>,
    );

beforeEach(() => {
    sessionStorage.clear();
    vi.resetAllMocks();
    // Radix Select uses browser pointer capture and scrolling, which JSDOM does not implement.
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(api.fetchImportContext).mockResolvedValue({ batchSize: 25, definitions: [], titles: [], tags: [] });
    vi.mocked(api.startMarkdownImport).mockImplementation(async (_workspaceId, mappings) => ({
        token: 'session',
        batchSize: 25,
        mappings: mappings.map((mapping) => ({
            source: mapping.source,
            key: 'field',
            valueType: mapping.valueType ?? 'text',
        })),
    }));
    let id = 10;
    vi.mocked(api.createImportNotes).mockImplementation(async (_token, notes) => ({
        notes: notes.map((note) => ({ path: note.path, id: String(id++) })),
        errors: [],
    }));
    vi.mocked(api.saveImportNotes).mockImplementation(async (_token, notes) => ({
        saved: notes.map((note) => note.path),
        errors: [],
    }));
    vi.mocked(api.trashImportedNotes).mockResolvedValue({ trashed: 3, errors: [] });
});

it('offers folder and zip choices that explain which source to pick', () => {
    renderPage();

    expect(screen.getByLabelText('Upload folder')).toBeEnabled();
    expect(screen.getByLabelText('Upload folder')).toHaveAccessibleDescription(/the one that contains \.obsidian/);
    expect(screen.getByLabelText('Upload zip')).toBeEnabled();
    expect(screen.getByLabelText('Upload zip')).toHaveAccessibleDescription(/Notion export/);
    expect(screen.getByRole('combobox', { name: 'Target workspace' })).toHaveTextContent('First');
});

it('explains removed metadata in readable groups', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByLabelText('Upload folder'), file('A.md', '---\npublish: true\n---\nBody'));

    expect(await screen.findByText('Skipped properties (1)')).toBeInTheDocument();
    expect(
        screen.getByText('Metadata fields you chose to skip, including publishing settings disabled by default.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('discarded-property (1)')).not.toBeInTheDocument();
});

it('resets property decisions coherently when the target workspace changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByLabelText('Upload folder'), file('A.md', '---\npriority: 4\n---\nBody'));
    await user.click(await screen.findByRole('combobox', { name: 'Map priority' }));
    await user.click(screen.getByRole('option', { name: 'Discard', exact: true }));
    await user.click(screen.getByRole('combobox', { name: 'Target workspace' }));
    await user.click(screen.getByRole('option', { name: 'Second', exact: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import 1 note' })).toBeEnabled());
    expect(screen.getByRole('combobox', { name: 'Map priority' })).toHaveTextContent('Create property');
    await user.click(screen.getByRole('button', { name: 'Import 1 note' }));

    await screen.findByText('1 note imported');
    expect(api.startMarkdownImport).toHaveBeenCalledWith(
        '2',
        expect.arrayContaining([expect.objectContaining({ source: 'priority', mode: 'new' })]),
    );
    expect(vi.mocked(api.saveImportNotes).mock.calls[0][1][0].properties).toEqual({ priority: '4' });
});

it('imports a folder through preview and shows the contents note and trash-all result', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(screen.getByLabelText('Upload folder'), [
        file('A.md', '[[B|My choice]]'),
        file('B.md', 'Destination'),
    ]);
    expect(await screen.findByText('2 notes · 0 images · 2 selected files')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import 2 notes' }));

    expect(await screen.findByText('2 notes imported')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open contents note' })).toHaveAttribute('href', '/12');
    expect(vi.mocked(api.saveImportNotes).mock.calls[0][1][0].markdown).toContain('[[My choice]](note:11)');
    await user.click(screen.getByRole('button', { name: 'Move all imported notes to trash' }));
    expect(api.trashImportedNotes).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Imported notes moved to trash')).toBeInTheDocument();
    expect(api.trashImportedNotes).toHaveBeenCalledWith('session');
});

it('lets users keep publishing metadata and disable a tag before importing', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(
        screen.getByLabelText('Upload folder'),
        file('A.md', '---\npublish: true\npriority: 4\n---\n#topic'),
    );
    expect(await screen.findByRole('combobox', { name: 'Map publish' })).toHaveTextContent('Discard');
    await user.click(screen.getByRole('combobox', { name: 'Map publish' }));
    await user.click(screen.getByRole('option', { name: 'Create property', exact: true }));
    await user.click(screen.getByLabelText('topic (new)'));
    await user.click(screen.getByRole('button', { name: 'Import 1 note' }));

    await screen.findByText('1 note imported');
    expect(api.startMarkdownImport).toHaveBeenCalledWith(
        '1',
        expect.arrayContaining([
            { source: 'publish', mode: 'new', name: 'publish', valueType: 'boolean', options: undefined },
        ]),
    );
    expect(vi.mocked(api.saveImportNotes).mock.calls[0][1][0].markdown).toContain('#topic');
    expect(vi.mocked(api.saveImportNotes).mock.calls[0][1][0].markdown).not.toContain('[@topic]');
});

it('reports save failures and keeps trash-all available for partial imports', async () => {
    vi.mocked(api.saveImportNotes).mockResolvedValue({
        saved: [],
        errors: [{ path: 'A.md', message: 'Property value is invalid' }],
    });
    const user = userEvent.setup();
    renderPage();

    await user.upload(screen.getByLabelText('Upload folder'), file('A.md', 'Body'));
    await user.click(await screen.findByRole('button', { name: 'Import 1 note' }));

    await screen.findByText('1 note created · 0 saved with content');
    expect(screen.getByText('Content save failures (1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move all imported notes to trash' })).toBeEnabled();
});

it('recovers the most recent result after returning to the page', async () => {
    sessionStorage.setItem(
        'ocean-brain:markdown-import-result',
        JSON.stringify({ token: 'old', ids: { 'A.md': '20' }, saved: 1, issues: [], workspaceId: '1' }),
    );
    renderPage();

    expect(screen.getByText('1 note imported')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move all imported notes to trash' })).toBeEnabled();
});

it('keeps the full report during navigation when browser storage only fits a summary', async () => {
    const original = Storage.prototype.setItem;
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
        if (key === 'ocean-brain:markdown-import-result' && JSON.parse(value).issues?.length)
            throw new DOMException('Full', 'QuotaExceededError');
        original.call(this, key, value);
    });
    try {
        const user = userEvent.setup();
        const page = renderPage();
        await user.upload(screen.getByLabelText('Upload folder'), [file('A.md', 'Body'), file('unused.txt', 'Unused')]);
        await user.click(await screen.findByRole('button', { name: 'Import 1 note' }));
        await screen.findByText('1 note imported');
        page.unmount();

        renderPage();

        expect(screen.getByText('Skipped files (1)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Move all imported notes to trash' })).toBeEnabled();
    } finally {
        storage.mockRestore();
    }
});

it('shows recovered counts honestly when only a compact report survived a refresh', () => {
    sessionStorage.setItem(
        'ocean-brain:markdown-import-result',
        JSON.stringify({
            token: 'compact',
            ids: {},
            createdCount: 7,
            saved: 7,
            issues: [],
            workspaceId: '1',
            recoverySummary: true,
            issueCounts: { 'skipped-file': 50000 },
        }),
    );

    renderPage();

    expect(screen.getByText('7 notes imported')).toBeInTheDocument();
    expect(screen.getByText('Skipped files (50000)')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Detailed item lists could not be restored');
    expect(screen.queryByText('Nothing was dropped or left unimported.')).not.toBeInTheDocument();
});

it('exposes a retry when workspace context cannot be loaded', async () => {
    vi.mocked(api.fetchImportContext).mockRejectedValue(new Error('Offline'));
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('alert');
    vi.mocked(api.fetchImportContext).mockResolvedValue({ batchSize: 25, definitions: [], titles: [], tags: [] });
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
