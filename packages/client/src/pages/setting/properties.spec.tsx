import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    createNotePropertyKey,
    deleteNotePropertyKey,
    fetchNotePropertyKeys,
    updateNotePropertyKey,
} from '~/apis/note.api';
import { ToastProvider } from '~/components/ui';
import { createTestQueryClient } from '~/test/test-utils';
import PropertiesSettings from './properties';

vi.mock('@tanstack/react-router', () => ({
    getRouteApi: () => ({
        useSearch: () => ({ page: 1 }),
    }),
}));

vi.mock('~/apis/note.api', () => ({
    createNotePropertyKey: vi.fn(),
    deleteNotePropertyKey: vi.fn(),
    fetchNotePropertyKeys: vi.fn(),
    updateNotePropertyKey: vi.fn(),
}));

const propertyKey = {
    key: 'state',
    name: 'State',
    valueType: 'select' as const,
    noteCount: 1,
    options: [
        {
            id: '1',
            label: 'Todo',
            value: 'todo',
            color: null,
            order: 0,
        },
        {
            id: '2',
            label: 'Doing',
            value: 'doing',
            color: null,
            order: 1,
        },
    ],
    updatedAt: '2026-06-01T00:00:00.000Z',
};

const renderPage = () => {
    const queryClient = createTestQueryClient();

    render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <PropertiesSettings />
            </ToastProvider>
        </QueryClientProvider>,
    );
};

describe('<PropertiesSettings />', () => {
    beforeEach(() => {
        vi.mocked(fetchNotePropertyKeys).mockResolvedValue({
            type: 'success',
            notePropertyKeys: {
                totalCount: 1,
                keys: [propertyKey],
            },
        } as never);
        vi.mocked(updateNotePropertyKey).mockResolvedValue({
            type: 'success',
            updateNotePropertyKey: {
                ...propertyKey,
                name: 'Workflow state',
            },
        } as never);
        vi.mocked(createNotePropertyKey).mockResolvedValue({
            type: 'success',
            createNotePropertyKey: propertyKey,
        } as never);
        vi.mocked(deleteNotePropertyKey).mockResolvedValue({
            type: 'success',
            deleteNotePropertyKey: {
                key: propertyKey.key,
                name: propertyKey.name,
                valueType: propertyKey.valueType,
                affectedNoteCount: 0,
                deleted: true,
            },
        } as never);
    });

    it('edits a shared property definition from the settings page', async () => {
        renderPage();

        await screen.findByText('State');
        await userEvent.click(screen.getByRole('button', { name: /edit/i }));

        expect(screen.getByDisplayValue('todo')).toBeDisabled();
        expect(screen.getAllByText('Locked')).toHaveLength(2);
        expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
        const nameInput = screen.getByLabelText(/name/i);
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Workflow state');
        await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => {
            expect(updateNotePropertyKey).toHaveBeenCalledWith({
                key: 'state',
                name: 'Workflow state',
                options: [
                    { id: '1', label: 'Todo', value: 'todo', color: null, order: 0 },
                    { id: '2', label: 'Doing', value: 'doing', color: null, order: 1 },
                ],
            });
        });
    });
});
