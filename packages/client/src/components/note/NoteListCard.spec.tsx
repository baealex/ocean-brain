import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

import NoteListCard from './NoteListCard';

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        children,
        ...props
    }: {
        children: ReactNode;
        [key: string]: unknown;
    }) => <a {...props}>{children}</a>
}));

describe('<NoteListCard />', () => {
    it('renders the note title as a navigable card link', () => {
        render(
            <NoteListCard
                id="note-1"
                title="Quiet capture"
                tags={[]}
                pinned
                createdAt={Date.now()}
                updatedAt={Date.now()}
            />
        );

        const titleLink = screen.getByText('Quiet capture').closest('a');

        expect(titleLink).toBeInTheDocument();
        expect(screen.getByText('Quiet capture')).toBeInTheDocument();
    });

    it('exposes an accessible name for the note actions trigger', () => {
        render(
            <NoteListCard
                id="note-2"
                title="Accessible note"
                tags={[]}
                pinned={false}
                createdAt={Date.now()}
                updatedAt={Date.now()}
            />
        );

        expect(screen.getByRole('button', { name: 'Note actions' })).toBeInTheDocument();
    });
});
