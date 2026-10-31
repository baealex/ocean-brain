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

    it('shows existing option values as editable when the edit dialog opens', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('State');

        await user.click(screen.getByRole('button', { name: /edit/i }));

        expect(screen.getByDisplayValue('todo')).toBeEnabled();
        expect(screen.getAllByText('Existing')).toHaveLength(2);
    });

    it('keeps Save changes disabled when the edit dialog opens without changes', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('State');

        await user.click(screen.getByRole('button', { name: /edit/i }));

        expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });

    it('saves a renamed property from the edit dialog', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('State');
        await user.click(screen.getByRole('button', { name: /edit/i }));
        const nameInput = screen.getByLabelText(/name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'Workflow state');

        await user.click(screen.getByRole('button', { name: /save changes/i }));

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

    it('saves a reordered option list from the edit dialog', async () => {
        renderPage();

        await screen.findByText('State');
        await userEvent.click(screen.getByRole('button', { name: /edit/i }));
        await userEvent.click(screen.getByRole('button', { name: 'Actions for Doing option' }));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Move up' }));
        await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => {
            expect(updateNotePropertyKey).toHaveBeenCalledWith({
                key: 'state',
                name: 'State',
                options: [
                    { id: '2', label: 'Doing', value: 'doing', color: null, order: 0 },
                    { id: '1', label: 'Todo', value: 'todo', color: null, order: 1 },
                ],
            });
        });
    });

    describe('after changing an existing option value', () => {
        const changeTodoValue = async (user: ReturnType<typeof userEvent.setup>) => {
            await screen.findByText('State');
            await user.click(screen.getByRole('button', { name: /edit/i }));
            const valueInput = screen.getByDisplayValue('todo');
            await user.clear(valueInput);
            await user.type(valueInput, 'to-do');
        };

        it('shows the old and new value when Save changes is clicked', async () => {
            const user = userEvent.setup();
            renderPage();
            await changeTodoValue(user);

            await user.click(screen.getByRole('button', { name: /save changes/i }));

            expect(await screen.findByText('todo → to-do')).toBeInTheDocument();
        });

        it('warns that MCP queries and scripts using the old values are not updated when Save changes is clicked', async () => {
            const user = userEvent.setup();
            renderPage();
            await changeTodoValue(user);

            await user.click(screen.getByRole('button', { name: /save changes/i }));

            expect(
                await screen.findByText(/MCP queries and scripts that use the old values are not updated/),
            ).toBeInTheDocument();
        });

        it('does not save before the change is confirmed', async () => {
            const user = userEvent.setup();
            vi.mocked(updateNotePropertyKey).mockClear();
            renderPage();
            await changeTodoValue(user);

            await user.click(screen.getByRole('button', { name: /save changes/i }));
            await screen.findByText('todo → to-do');

            expect(updateNotePropertyKey).not.toHaveBeenCalled();
        });

        it('saves the new value when Change values is clicked', async () => {
            const user = userEvent.setup();
            vi.mocked(updateNotePropertyKey).mockClear();
            renderPage();
            await changeTodoValue(user);
            await user.click(screen.getByRole('button', { name: /save changes/i }));

            await user.click(await screen.findByRole('button', { name: 'Change values' }));

            await waitFor(() => {
                expect(updateNotePropertyKey).toHaveBeenCalledWith({
                    key: 'state',
                    name: 'State',
                    options: [
                        { id: '1', label: 'Todo', value: 'to-do', color: null, order: 0 },
                        { id: '2', label: 'Doing', value: 'doing', color: null, order: 1 },
                    ],
                });
            });
        });
    });
});
