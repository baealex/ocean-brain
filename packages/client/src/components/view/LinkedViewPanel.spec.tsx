import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchAllNotePropertyKeys } from '~/apis/note.api';
import { fetchViewNotes, fetchViewWorkspace } from '~/apis/view.api';
import type { View } from '~/models/view.model';
import { createQueryClientWrapper } from '~/test/test-utils';
import LinkedViewPanel from './LinkedViewPanel';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, params }: { children: React.ReactNode; params?: { id: string } }) => (
        <a href={params ? `/${params.id}` : '/views'}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
}));
vi.mock('~/apis/view.api', () => ({
    fetchViewWorkspace: vi.fn(),
    fetchViewNotes: vi.fn(),
    fetchView: vi.fn().mockResolvedValue({ type: 'success', view: null }),
}));
vi.mock('~/apis/note.api', () => ({ fetchAllNotePropertyKeys: vi.fn() }));

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
    it('leaves Enter to the input while text composition is in progress', async () => {
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: {
                activeGroupId: '7',
                groups: [{ id: '7', title: 'Project Alpha', order: 0, views: [view] }],
            },
        });
        const onSelect = vi.fn();
        render(<LinkedViewPanel viewId="" viewTitle="" editable onSelect={onSelect} onRemove={vi.fn()} />, {
            wrapper: createQueryClientWrapper().Wrapper,
        });
        const input = await screen.findByRole('textbox', { name: 'Search views' });
        const composingEnter = new KeyboardEvent('keydown', {
            key: 'Enter',
            isComposing: true,
            bubbles: true,
            cancelable: true,
        });

        fireEvent(input, composingEnter);

        expect(composingEnter.defaultPrevented).toBe(false);
        expect(onSelect).not.toHaveBeenCalled();
    });
    it('connects the sole search result by pressing Enter in the inline search', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: {
                activeGroupId: '7',
                groups: [{ id: '7', title: 'Project Alpha', order: 0, views: [view] }],
            },
        });
        render(<LinkedViewPanel viewId="" viewTitle="" editable onSelect={onSelect} onRemove={vi.fn()} />, {
            wrapper: createQueryClientWrapper().Wrapper,
        });

        await user.type(await screen.findByRole('textbox', { name: 'Search views' }), 'Alpha{Enter}');

        expect(onSelect).toHaveBeenCalledWith(view);
    });

    it('cancels inline replacement with Escape while preserving the unavailable connection', async () => {
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
        render(<LinkedViewPanel viewId="99" viewTitle="Archived" editable onSelect={onSelect} onRemove={onRemove} />, {
            wrapper: createQueryClientWrapper().Wrapper,
        });
        await user.click(await screen.findByRole('button', { name: 'Choose another view' }));

        await user.type(screen.getByRole('textbox', { name: 'Search views' }), 'Alpha{Escape}');

        expect(screen.getByText('Linked view is unavailable')).toBeVisible();
        expect(screen.queryByRole('textbox', { name: 'Search views' })).not.toBeInTheDocument();
        expect(onSelect).not.toHaveBeenCalled();
        expect(onRemove).not.toHaveBeenCalled();
    });

    it('resets local pagination when sorting without saving changes to the linked view', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: {
                activeGroupId: '7',
                groups: [{ id: '7', title: 'Project Alpha', order: 0, views: [{ ...view, limit: 1 }] }],
            },
        });
        vi.mocked(fetchAllNotePropertyKeys).mockResolvedValue({ type: 'success', notePropertyKeys: { keys: [] } });
        vi.mocked(fetchViewNotes).mockImplementation(async (_id, options) => ({
            type: 'success',
            viewNotes: {
                totalCount: 2,
                notes: [
                    {
                        id: options?.offset ? '2' : '1',
                        title: options?.offset ? 'Second meeting' : 'First meeting',
                        content: '',
                        pinned: false,
                        order: 0,
                        layout: 'wide',
                        tags: [],
                        createdAt: '1780000000000',
                        updatedAt: '1780000000000',
                    },
                ],
            },
        }));
        render(
            <LinkedViewPanel viewId="42" viewTitle="Meetings" editable={false} onSelect={vi.fn()} onRemove={vi.fn()} />,
            { wrapper: createQueryClientWrapper().Wrapper },
        );
        await screen.findByRole('link', { name: /First meeting/ });
        await user.click(screen.getByRole('button', { name: 'Next page' }));
        await screen.findByRole('link', { name: /Second meeting/ });

        await user.click(screen.getByRole('button', { name: 'Sort: Recently updated' }));
        await user.click(screen.getByRole('menuitemradio', { name: 'Title: A to Z' }));

        expect(await screen.findByRole('link', { name: /First meeting/ })).toHaveAttribute('href', '/1');
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
        expect(fetchViewNotes).toHaveBeenLastCalledWith('42', {
            limit: 1,
            offset: 0,
            sortBy: 'title',
            sortOrder: 'asc',
        });
        expect(screen.queryByRole('button', { name: 'Page 1' })).not.toBeInTheDocument();
    });
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
