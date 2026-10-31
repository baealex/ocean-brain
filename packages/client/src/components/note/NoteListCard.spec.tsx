import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';

import { NOTE_ROUTE } from '~/modules/url';

import NoteListCard from './NoteListCard';

const renderCard = async (id: string, title: string, contentPreview?: string) => {
    const rootRoute = createRootRoute({
        component: () => (
            <NoteListCard
                id={id}
                title={title}
                contentPreview={contentPreview}
                tags={[]}
                pinned={false}
                createdAt={Date.now()}
                updatedAt={Date.now()}
            />
        ),
    });
    const noteRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: NOTE_ROUTE,
        component: () => null,
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren([noteRoute]),
        history: createMemoryHistory({ initialEntries: [`/${id}`] }),
    });

    render(<RouterProvider router={router} />);

    await act(async () => {
        await router.load();
    });
};

describe('<NoteListCard />', () => {
    it('links the note title to its note route', async () => {
        await renderCard('note-1', 'Quiet capture');

        expect(screen.getByRole('link', { name: 'Quiet capture' })).toHaveAttribute('href', '/note-1');
    });

    it('exposes an accessible name for the note actions trigger', async () => {
        await renderCard('note-2', 'Accessible note');

        expect(screen.getByRole('button', { name: 'Note actions' })).toBeInTheDocument();
    });

    it('shows the body preview under the title when the note has body text', async () => {
        await renderCard('note-3', 'Weekly plan', 'Ship the release notes before Friday');

        expect(screen.getByText('Ship the release notes before Friday')).toBeInTheDocument();
    });

    it('renders no body preview when the preview is blank', async () => {
        await renderCard('note-4', 'Empty note', '  ');

        expect(document.querySelector('p')).toBeNull();
    });
});
