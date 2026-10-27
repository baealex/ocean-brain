import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createNoteInView, fetchViewNoteCreationContext } from '~/apis/view.api';
import type { ViewNoteCreationContext } from '~/models/view.model';
import { createQueryClientWrapper } from '~/test/test-utils';
import ViewNoteCreateButton from './ViewNoteCreateButton';

vi.mock('~/apis/view.api', () => ({ createNoteInView: vi.fn(), fetchViewNoteCreationContext: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, params, children }: { to?: string; params?: { id: string }; children: React.ReactNode }) => (
        <a href={params ? `/${params.id}` : to}>{children}</a>
    ),
}));

const context: ViewNoteCreationContext = {
    viewId: '42',
    title: 'Project A meetings',
    tagNames: ['@project-a'],
    mode: 'and',
    defaultTagNames: ['@project-a'],
    properties: [
        {
            key: 'project',
            name: 'Project',
            valueType: 'text',
            defaultValue: 'A',
            required: true,
            options: [],
            filters: [],
        },
    ],
};
const renderButton = () =>
    render(<ViewNoteCreateButton viewId="42" />, { wrapper: createQueryClientWrapper().Wrapper });

describe('creation from a view', () => {
    it('keeps an empty text template default when submitted unchanged', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchViewNoteCreationContext).mockResolvedValue({
            type: 'success',
            viewNoteCreationContext: {
                ...context,
                templateNote: { id: '7', title: 'Meeting outline' },
                properties: [
                    { ...context.properties[0], key: 'owner', name: 'Owner', defaultValue: '', required: false },
                ],
            },
        });
        renderButton();

        await user.click(screen.getByRole('button', { name: 'New note' }));
        await user.type(await screen.findByLabelText('Title'), 'Weekly meeting');
        await user.click(screen.getByRole('button', { name: 'Create note' }));

        expect(createNoteInView).toHaveBeenCalledWith(
            '42',
            { title: 'Weekly meeting', tagNames: ['@project-a'] },
            undefined,
        );
    });

    it('can omit an optional inherited template property before creating the note', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchViewNoteCreationContext).mockResolvedValue({
            type: 'success',
            viewNoteCreationContext: {
                ...context,
                templateNote: { id: '7', title: 'Meeting outline' },
                properties: [
                    { ...context.properties[0], key: 'owner', name: 'Owner', defaultValue: 'Alex', required: false },
                ],
            },
        });
        renderButton();

        await user.click(screen.getByRole('button', { name: 'New note' }));
        await user.type(await screen.findByLabelText('Title'), 'Weekly meeting');
        await user.click(screen.getByRole('button', { name: 'Clear Owner' }));
        await user.click(screen.getByRole('button', { name: 'Create note' }));

        expect(createNoteInView).toHaveBeenCalledWith(
            '42',
            { title: 'Weekly meeting', tagNames: ['@project-a'], deletePropertyKeys: ['owner'] },
            undefined,
        );
    });

    beforeEach(() => {
        vi.mocked(fetchViewNoteCreationContext).mockResolvedValue({
            type: 'success',
            viewNoteCreationContext: context,
        });
        vi.mocked(createNoteInView).mockResolvedValue({
            type: 'success',
            createNoteInView: { id: '17', title: 'Weekly meeting' },
        });
    });

    it('submits the prefilled view context and offers the created original note', async () => {
        const user = userEvent.setup();
        renderButton();

        await user.click(screen.getByRole('button', { name: 'New note' }));
        await user.type(await screen.findByLabelText('Title'), 'Weekly meeting');
        await user.click(await screen.findByRole('button', { name: 'Create note' }));

        expect(createNoteInView).toHaveBeenCalledWith(
            '42',
            { title: 'Weekly meeting', tagNames: ['@project-a'], properties: [{ key: 'project', value: 'A' }] },
            undefined,
        );
        expect(await screen.findByRole('link', { name: 'Open note' })).toHaveAttribute('href', '/17');
    });

    it('requires an explicit OR tag choice and submits only that choice', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchViewNoteCreationContext).mockResolvedValue({
            type: 'success',
            viewNoteCreationContext: {
                ...context,
                mode: 'or',
                tagNames: ['@meeting', '@decision'],
                defaultTagNames: [],
                properties: [],
            },
        });
        renderButton();

        await user.click(screen.getByRole('button', { name: 'New note' }));
        await user.type(await screen.findByLabelText('Title'), 'Weekly meeting');
        expect(await screen.findByRole('button', { name: 'Create note' })).toBeDisabled();
        await user.click(await screen.findByRole('checkbox', { name: '@decision' }));
        await user.click(screen.getByRole('button', { name: 'Create note' }));

        expect(createNoteInView).toHaveBeenCalledWith(
            '42',
            { title: 'Weekly meeting', tagNames: ['@decision'] },
            undefined,
        );
        expect(await screen.findByRole('link', { name: 'Open note' })).toHaveAttribute('href', '/17');
    });

    it('preserves input after rejection so the user can correct the value and create the note', async () => {
        const user = userEvent.setup();
        vi.mocked(createNoteInView)
            .mockResolvedValueOnce({
                type: 'error',
                errors: [{ message: 'The note does not match the current view.' }],
            })
            .mockResolvedValueOnce({ type: 'success', createNoteInView: { id: '17', title: 'Weekly meeting' } });
        renderButton();

        await user.click(screen.getByRole('button', { name: 'New note' }));
        await user.type(await screen.findByLabelText('Title'), 'Weekly meeting');
        const project = await screen.findByLabelText('Project *');
        await user.clear(project);
        await user.type(project, 'B');
        await user.click(screen.getByRole('button', { name: 'Create note' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('does not match');
        expect(screen.getByLabelText('Title')).toHaveValue('Weekly meeting');
        expect(project).toHaveValue('B');
        await user.clear(project);
        await user.type(project, 'A');
        await user.click(screen.getByRole('button', { name: 'Create note' }));

        expect(createNoteInView).toHaveBeenLastCalledWith(
            '42',
            { title: 'Weekly meeting', tagNames: ['@project-a'], properties: [{ key: 'project', value: 'A' }] },
            undefined,
        );
        expect(await screen.findByRole('link', { name: 'Open note' })).toHaveAttribute('href', '/17');
    });

    it('retries failed view conditions and opens a usable creation form', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchViewNoteCreationContext)
            .mockResolvedValueOnce({ type: 'error', errors: [{ message: 'Offline' }] })
            .mockResolvedValueOnce({ type: 'success', viewNoteCreationContext: context });
        renderButton();

        await user.click(screen.getByRole('button', { name: 'New note' }));
        await user.click(await screen.findByRole('button', { name: 'Retry' }));
        await user.type(await screen.findByLabelText('Title'), 'Weekly meeting');

        expect(await screen.findByLabelText('Project *')).toHaveValue('A');
        expect(screen.getByLabelText('Title')).toHaveValue('Weekly meeting');
        expect(screen.getByRole('button', { name: 'Create note' })).toBeEnabled();
    });

    it('reopening the form uses the updated view defaults', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchViewNoteCreationContext)
            .mockResolvedValueOnce({ type: 'success', viewNoteCreationContext: context })
            .mockResolvedValueOnce({
                type: 'success',
                viewNoteCreationContext: {
                    ...context,
                    properties: context.properties.map((property) => ({ ...property, defaultValue: 'B' })),
                },
            });
        renderButton();
        await user.click(screen.getByRole('button', { name: 'New note' }));
        await screen.findByLabelText('Project *');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await user.click(screen.getByRole('button', { name: 'New note' }));

        await waitFor(() => expect(screen.getByLabelText('Project *')).toHaveValue('B'));
    });
});
