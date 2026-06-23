import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestQueryClient } from '~/test/test-utils';
import Graph from './Graph';

const routeState = vi.hoisted(() => ({
    navigate: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
    fetchNoteGraph: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        children,
        params,
        to,
        ...props
    }: {
        children: React.ReactNode;
        params?: { id?: string };
        to?: string;
    }) => (
        <a href={params?.id ? `/${params.id}` : to} {...props}>
            {children}
        </a>
    ),
    useNavigate: () => routeState.navigate,
}));

vi.mock('~/apis/note.api', () => apiMocks);

vi.mock('react-force-graph-2d', async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    return {
        default: React.forwardRef((_props, ref) => {
            React.useImperativeHandle(ref, () => ({
                enableZoomInteraction: vi.fn(),
                zoomToFit: vi.fn(),
            }));

            return <div data-testid="force-graph" />;
        }),
    };
});

const renderGraph = () => {
    const queryClient = createTestQueryClient();

    render(
        <QueryClientProvider client={queryClient}>
            <Graph />
        </QueryClientProvider>,
    );
};

describe('<Graph />', () => {
    beforeEach(() => {
        apiMocks.fetchNoteGraph.mockResolvedValue({
            type: 'success',
            noteGraph: {
                nodes: [
                    { id: 'note-1', title: 'Alpha note', connections: 1 },
                    { id: 'note-2', title: 'Beta note', connections: 1 },
                    { id: 'note-3', title: 'Isolated note', connections: 0 },
                ],
                links: [{ source: 'note-1', target: 'note-2' }],
            },
        });
    });

    it('provides a keyboard-accessible graph node list with note links and selection status', async () => {
        renderGraph();

        expect(await screen.findByRole('region', { name: 'Graph nodes' })).toBeInTheDocument();
        expect(screen.getByTestId('force-graph')).toBeInTheDocument();

        const alphaLink = screen.getByRole('link', { name: /Alpha note/ });
        expect(alphaLink).toHaveAttribute('href', '/note-1');
        expect(screen.queryByRole('link', { name: /Isolated note/ })).not.toBeInTheDocument();

        fireEvent.focus(alphaLink);

        expect(screen.getByRole('status')).toHaveTextContent('Alpha note selected, 1 links');
        expect(screen.getByRole('status')).toHaveTextContent('Linked to Beta note');
    });

    it('filters the accessible graph node list', async () => {
        const user = userEvent.setup();
        renderGraph();

        await user.type(await screen.findByRole('textbox', { name: 'Search graph nodes' }), 'beta');

        expect(screen.getByRole('link', { name: /Beta note/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Alpha note/ })).not.toBeInTheDocument();
    });
});
