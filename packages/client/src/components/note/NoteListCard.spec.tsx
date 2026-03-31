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
    it('renders a restrained card without sketch tape or sketch borders', () => {
        const { container } = render(
            <NoteListCard
                id="note-1"
                title="Quiet capture"
                tags={[]}
                pinned
                createdAt={Date.now()}
                updatedAt={Date.now()}
            />
        );

        screen.getByText('Quiet capture');

        expect(container.firstElementChild?.className).not.toContain('sketchy');
        expect(container.querySelector('.sketch-tape')).not.toBeInTheDocument();
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
