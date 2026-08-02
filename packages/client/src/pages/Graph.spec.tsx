import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestQueryClient } from '~/test/test-utils';
import Graph from './Graph';

const routeState = vi.hoisted(() => ({
    navigate: vi.fn(),
    search: {} as { selected?: string },
}));

const apiMocks = vi.hoisted(() => ({
    fetchNoteGraph: vi.fn(),
}));

const forceGraphState = vi.hoisted(() => ({
    props: null as null | {
        graphData?: { nodes: Array<{ id: string }> };
        onNodeClick?: (node: { id: string }) => void;
    },
    d3Force: vi.fn(),
    d3ReheatSimulation: vi.fn(),
    zoomToFit: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    getRouteApi: () => ({
        useNavigate: () => routeState.navigate,
        useSearch: () => routeState.search,
    }),
    Link: ({
        children,
        params,
        search: _search,
        to,
        ...props
    }: {
        children: React.ReactNode;
        params?: { id?: string };
        search?: unknown;
        to?: string;
    }) => (
        <a href={params?.id ? `/${params.id}` : to} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('~/apis/note.api', () => apiMocks);

vi.mock('react-force-graph-2d', async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    return {
        default: React.forwardRef(
            (
                props: {
                    graphData?: { nodes: Array<{ id: string }> };
                    onNodeClick?: (node: { id: string }) => void;
                },
                ref,
            ) => {
                forceGraphState.props = props;
                React.useImperativeHandle(ref, () => ({
                    d3Force: forceGraphState.d3Force,
                    d3ReheatSimulation: forceGraphState.d3ReheatSimulation,
                    zoomToFit: forceGraphState.zoomToFit,
                }));

                return <div data-testid="force-graph" />;
            },
        ),
    };
});

const graphFixture = {
    nodes: [
        {
            id: '1',
            title: 'Product direction',
            connections: 1,
            updatedAt: '1785600000000',
            tags: [{ id: 'tag-product', name: '@product' }],
        },
        {
            id: '2',
            title: 'Graph ideas',
            connections: 2,
            updatedAt: '1785600001000',
            tags: [{ id: 'tag-product', name: '@product' }],
        },
        {
            id: '3',
            title: 'Search notes',
            connections: 2,
            updatedAt: '1785600002000',
            tags: [{ id: 'tag-product', name: '@product' }],
        },
        {
            id: '4',
            title: 'Reading queue',
            connections: 2,
            updatedAt: '1785600003000',
            tags: [{ id: 'tag-reading', name: '@reading' }],
        },
        {
            id: '5',
            title: 'Book notes',
            connections: 1,
            updatedAt: '1785600004000',
            tags: [{ id: 'tag-reading', name: '@reading' }],
        },
        {
            id: '6',
            title: 'Unlinked scratch',
            connections: 0,
            updatedAt: '1785600005000',
            tags: [{ id: 'tag-scratch', name: '@scratch' }],
        },
    ],
    links: [
        { source: '1', target: '2' },
        { source: '2', target: '3' },
        { source: '3', target: '4' },
        { source: '4', target: '5' },
    ],
};

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
        routeState.navigate.mockReset();
        routeState.search = {};
        forceGraphState.props = null;
        forceGraphState.d3Force.mockReset();
        forceGraphState.d3ReheatSimulation.mockReset();
        forceGraphState.zoomToFit.mockReset();
        apiMocks.fetchNoteGraph.mockResolvedValue({
            type: 'success',
            noteGraph: graphFixture,
        });
    });

    it('presents linked communities as selectable connection areas', async () => {
        renderGraph();

        expect(await screen.findByRole('region', { name: 'Connection areas' })).toBeInTheDocument();
        expect(screen.getByTestId('force-graph')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Graph ideas/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: /Reading queue/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('5 linked notes · 2 areas · 4 connections')).toBeInTheDocument();
    });

    it('focuses a connection area from the visual legend', async () => {
        const user = userEvent.setup();
        renderGraph();

        const readingCluster = await screen.findByRole('button', { name: /Reading queue/ });
        await user.click(readingCluster);

        expect(readingCluster).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('status')).toHaveTextContent('Reading queue highlighted');

        await user.click(readingCluster);
        expect(readingCluster).toHaveAttribute('aria-pressed', 'false');
    });

    it('restores a selected node into a focused insight panel', async () => {
        routeState.search = { selected: '2' };
        renderGraph();

        expect(await screen.findByRole('region', { name: 'Graph ideas' })).toHaveTextContent('Near Graph ideas');
        expect(screen.getByLabelText('Selected note tags')).toHaveTextContent('@product');
        expect(screen.getByRole('button', { name: 'Product direction' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Search notes' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open note' })).toHaveAttribute('href', '/2');
        expect(screen.getByRole('status')).toHaveTextContent('Graph ideas selected near Graph ideas');
    });

    it('selects a graph node through the canvas interaction contract', async () => {
        renderGraph();

        await screen.findByTestId('force-graph');
        const node = forceGraphState.props?.graphData?.nodes.find((item) => item.id === '4');
        expect(node).toBeDefined();

        act(() => {
            if (node) {
                forceGraphState.props?.onNodeClick?.(node);
            }
        });

        expect(routeState.navigate).toHaveBeenCalledWith({
            search: expect.any(Function),
            replace: true,
        });
        expect(routeState.navigate.mock.calls[0][0].search({})).toEqual({ selected: '4' });
    });

    it('fits the full connection map on request', async () => {
        const user = userEvent.setup();
        renderGraph();

        expect(await screen.findByTestId('force-graph')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Fit connection map' }));
        expect(forceGraphState.zoomToFit).toHaveBeenCalled();
    });

    it('keeps the empty state tied to actual note connections', async () => {
        apiMocks.fetchNoteGraph.mockResolvedValue({
            type: 'success',
            noteGraph: {
                nodes: graphFixture.nodes.map((node) => ({ ...node, connections: 0 })),
                links: [],
            },
        });
        renderGraph();

        expect(await screen.findByText('No map yet')).toBeInTheDocument();
    });
});
