import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchViewWorkspace } from '~/apis/view.api';
import type { View } from '~/models/view.model';
import { createQueryClientWrapper } from '~/test/test-utils';
import LinkedViewPanel from './LinkedViewPanel';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a href="/views">{children}</a>,
    useNavigate: () => vi.fn(),
}));
vi.mock('~/apis/view.api', () => ({ fetchViewWorkspace: vi.fn() }));

const view: View = {
    id: '42',
    groupId: '7',
    title: 'Meetings',
    displayType: 'list',
    displayOptions: {
        tableColumns: ['title'],
        tablePropertyKeys: [],
        boardGroupByPropertyKey: null,
        calendarDateField: 'createdAt',
        calendarDatePropertyKey: null,
    },
    tagNames: ['@meeting'],
    mode: 'and',
    propertyFilters: [],
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 5,
    order: 0,
};

describe('LinkedViewPanel', () => {
    it('group search disambiguates saved views with identical titles', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: {
                activeGroupId: '7',
                groups: [
                    { id: '7', title: 'Project Alpha', order: 0, views: [view] },
                    { id: '8', title: 'Project Beta', order: 1, views: [{ ...view, id: '43', groupId: '8' }] },
                ],
            },
        });
        const { Wrapper } = createQueryClientWrapper();

        render(<LinkedViewPanel viewId="" viewTitle="" editable onSelect={onSelect} onRemove={vi.fn()} />, {
            wrapper: Wrapper,
        });
        await user.type(await screen.findByRole('textbox', { name: 'Search views' }), 'Alpha');
        await user.click(screen.getByRole('button', { name: /Meetings/ }));

        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '42', groupId: '7' }));
    });

    it('choosing a replacement requests the selected view without removing the block', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        const onRemove = vi.fn();
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: {
                activeGroupId: '7',
                groups: [{ id: '7', title: 'Project Alpha', order: 0, views: [view] }],
            },
        });
        const { Wrapper } = createQueryClientWrapper();

        render(
            <LinkedViewPanel
                viewId="99"
                viewTitle="Archived meetings"
                editable
                onSelect={onSelect}
                onRemove={onRemove}
            />,
            { wrapper: Wrapper },
        );

        const replace = await screen.findByRole('button', { name: 'Choose another view' });

        await user.click(replace);
        await user.click(screen.getByRole('button', { name: /Meetings/ }));

        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '42' }));
        expect(onRemove).not.toHaveBeenCalled();
    });

    it('retry recovers the view picker after a temporary loading failure', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchViewWorkspace)
            .mockRejectedValueOnce(new Error('Offline'))
            .mockResolvedValue({
                type: 'success',
                viewWorkspace: {
                    activeGroupId: '7',
                    groups: [{ id: '7', title: 'Project Alpha', order: 0, views: [view] }],
                },
            });
        const { Wrapper } = createQueryClientWrapper();

        render(<LinkedViewPanel viewId="" viewTitle="" editable onSelect={vi.fn()} onRemove={vi.fn()} />, {
            wrapper: Wrapper,
        });

        const retry = await screen.findByRole('button', { name: 'Retry' });

        await user.click(retry);

        expect(await screen.findByRole('textbox', { name: 'Search views' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Meetings/ })).toBeInTheDocument();
    });

    it('keeps an unavailable connection read-only when the note is read-only', async () => {
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: { activeGroupId: null, groups: [] },
        });
        const { Wrapper } = createQueryClientWrapper();

        render(
            <LinkedViewPanel viewId="99" viewTitle="Archived" editable={false} onSelect={vi.fn()} onRemove={vi.fn()} />,
            { wrapper: Wrapper },
        );

        expect(await screen.findByText('Linked view is unavailable')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose another view' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove linked view' })).not.toBeInTheDocument();
    });
});
