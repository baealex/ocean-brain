import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

import NoteListCard from './NoteListCard';

vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

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
});
