import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

import { createQueryClientWrapper } from '~/test/test-utils';

import PinnedNotesPanel from './PinnedNotesPanel';

type MockPinnedNote = {
    id: string;
    title: string;
    order: number;
};

type RouterLocation = {
    pathname: string;
};

let mockPinnedNotes: MockPinnedNote[] = [];

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
    useLocation: ({ select }: { select: (location: RouterLocation) => unknown }) => select({ pathname: '/note-2' })
}));

vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: { children: ReactNode }) => <div data-testid="dnd-context">{children}</div>,
    KeyboardSensor: class KeyboardSensor {},
    PointerSensor: class PointerSensor {},
    closestCenter: vi.fn(),
    useSensor: vi.fn((sensor: unknown, options?: unknown) => ({
        sensor,
        options
    })),
    useSensors: vi.fn((...sensors: unknown[]) => sensors)
}));

vi.mock('@dnd-kit/modifiers', () => ({ restrictToVerticalAxis: vi.fn() }));

vi.mock('@dnd-kit/sortable', () => ({
    SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    arrayMove: vi.fn((items: unknown[]) => items),
    sortableKeyboardCoordinates: vi.fn(),
    useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        setActivatorNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: false
    }),
    verticalListSortingStrategy: {}
}));

vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => undefined } } }));

vi.mock('~/apis/note.api', () => ({ reorderNotes: vi.fn() }));

vi.mock('~/components/app', () => ({
    QueryBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
    QueryErrorView: () => <div>Error</div>
}));

vi.mock('~/components/entities', () => ({
    PinnedNotes: ({ render }: { render: (notes: MockPinnedNote[]) => ReactNode }) => (
        <>{render(mockPinnedNotes)}</>
    )
}));

vi.mock('~/components/ui', () => ({ Tooltip: ({ children }: { children: ReactNode }) => <>{children}</> }));

describe('<PinnedNotesPanel />', () => {
    it('renders the empty state when no pinned notes are available', () => {
        mockPinnedNotes = [];
        const { Wrapper } = createQueryClientWrapper();

        render(<PinnedNotesPanel />, { wrapper: Wrapper });

        expect(
            screen.getByText('Pin a note to keep it in view while the rest of the workspace changes.')
        ).toBeInTheDocument();
    });

    it('renders pinned notes with a drag handle affordance', () => {
        mockPinnedNotes = [{
            id: 'note-2',
            title: 'Editorial note',
            order: 0
        }];
        const { Wrapper } = createQueryClientWrapper();

        render(<PinnedNotesPanel />, { wrapper: Wrapper });

        expect(screen.getByText('Editorial note')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveClass('cursor-grab');
        expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    });
});
