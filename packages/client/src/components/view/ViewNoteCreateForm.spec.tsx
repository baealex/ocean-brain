import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '~/components/ui';
import type { ViewNoteCreationContext } from '~/models/view.model';
import ViewNoteCreateForm from './ViewNoteCreateForm';

it('adopts new defaults without replacing fields the user has edited', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const context: ViewNoteCreationContext = {
        viewId: '42',
        title: 'Meetings',
        mode: 'and',
        tagNames: [],
        defaultTagNames: [],
        properties: [
            {
                key: 'project',
                name: 'Project',
                valueType: 'text',
                defaultValue: null,
                required: true,
                options: [],
                filters: [],
            },
        ],
    };
    const form = (value: ViewNoteCreationContext) => (
        <Modal isOpen onClose={vi.fn()}>
            <ViewNoteCreateForm context={value} pending={false} onSubmit={onSubmit} onClose={vi.fn()} />
        </Modal>
    );
    const { rerender } = render(form(context));
    await user.type(screen.getByLabelText('Title'), 'Weekly meeting');
    await user.type(screen.getByLabelText('Project *'), 'My project');

    rerender(
        form({
            ...context,
            tagNames: ['@meeting'],
            defaultTagNames: ['@meeting'],
            properties: [
                { ...context.properties[0]!, defaultValue: 'A' },
                { ...context.properties[0]!, key: 'owner', name: 'Owner', defaultValue: 'Alex' },
            ],
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Create note' }));

    expect(onSubmit).toHaveBeenCalledWith({
        title: 'Weekly meeting',
        tagNames: ['@meeting'],
        properties: [
            { key: 'project', value: 'My project' },
            { key: 'owner', value: 'Alex' },
        ],
    });
});
