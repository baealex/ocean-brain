import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
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
        enableZoomInteraction?: (event: MouseEvent) => boolean;
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
                    enableZoomInteraction?: (event: MouseEvent) => boolean;
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

const fourAreaFixture = {
    nodes: Array.from({ length: 8 }, (_, index) => ({
        id: String(index + 1),
        title: `Area ${Math.floor(index / 2) + 1}`,
        connections: 1,
        updatedAt: String(1785600000000 + index),
        tags: [],
    })),
    links: Array.from({ length: 4 }, (_, index) => ({
        source: String(index * 2 + 1),
        target: String(index * 2 + 2),
    })),
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

    it('presents the graph with unobstructed next steps', async () => {
        renderGraph();

        const controls = await screen.findByRole('region', { name: 'Explore graph' });
        const startingPoint = await screen.findByRole('region', { name: 'Start with Graph ideas' });
        const insights = await screen.findByRole('region', { name: 'Next steps' });

        expect(within(controls).getByRole('button', { name: /Explore areas/ })).toBeInTheDocument();
        expect(insights).toBeInTheDocument();
        expect(screen.getByTestId('force-graph')).toBeInTheDocument();
        expect(within(startingPoint).getByRole('heading', { name: 'Start with Graph ideas' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Review notes' })).toBeInTheDocument();
        expect(within(startingPoint).getByRole('button', { name: 'Search notes' })).toBeInTheDocument();
        expect(within(insights).queryByRole('button', { name: /Explore areas/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Connection areas' })).not.toBeInTheDocument();
    });

    it('opens an inline unlinked-note review without adding notes to the canvas', async () => {
        const user = userEvent.setup();
        renderGraph();

        await user.click(await screen.findByRole('button', { name: 'Review notes' }));
        const reviewPanel = await screen.findByRole('region', { name: 'Review notes without connections' });

        expect(forceGraphState.props?.graphData?.nodes).toHaveLength(5);
        expect(
            within(reviewPanel).getByRole('searchbox', { name: 'Search notes without connections' }),
        ).toBeInTheDocument();
        expect(within(reviewPanel).getByRole('link', { name: /Unlinked scratch/ })).toHaveAttribute('href', '/6');

        await user.type(
            within(reviewPanel).getByRole('searchbox', { name: 'Search notes without connections' }),
            'scratch',
        );
        expect(within(reviewPanel).getByRole('link', { name: /Unlinked scratch/ })).toBeInTheDocument();
        expect(within(reviewPanel).queryByRole('link', { name: /Product direction/ })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Hide review' }));
        expect(screen.queryByRole('region', { name: 'Review notes without connections' })).not.toBeInTheDocument();
    });

    it('keeps every connection area actionable', async () => {
        const user = userEvent.setup();
        apiMocks.fetchNoteGraph.mockResolvedValue({
            type: 'success',
            noteGraph: fourAreaFixture,
        });
        renderGraph();

        const controls = await screen.findByRole('region', { name: 'Explore graph' });
        await user.click(within(controls).getByRole('button', { name: /Explore areas/ }));
        const areaList = await screen.findByRole('list', { name: 'Connection areas' });
        expect(within(areaList).getAllByRole('button')).toHaveLength(4);

        const lastArea = within(areaList).getByRole('button', { name: /Area 4/ });
        await user.click(lastArea);
        expect(lastArea).toHaveAttribute('aria-pressed', 'true');
    });

    it('lets users follow a connected note from the recommended starting point', async () => {
        const user = userEvent.setup();
        renderGraph();

        const startingPoint = await screen.findByRole('region', { name: 'Start with Graph ideas' });
        await user.click(within(startingPoint).getByRole('button', { name: 'Search notes' }));

        expect(routeState.navigate).toHaveBeenCalledWith({
            search: expect.any(Function),
            replace: true,
        });
        expect(routeState.navigate.mock.calls[0][0].search({})).toEqual({ selected: '3' });
    });

    it('focuses a connection area from the visual legend', async () => {
        const user = userEvent.setup();
        renderGraph();

        const controls = await screen.findByRole('region', { name: 'Explore graph' });
        await user.click(within(controls).getByRole('button', { name: /Explore areas/ }));
        const areaList = await screen.findByRole('list', { name: 'Connection areas' });
        const readingCluster = within(areaList).getByRole('button', { name: /Reading queue/ });
        await user.click(readingCluster);

        expect(readingCluster).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('status')).toHaveTextContent('Reading queue highlighted');

        await user.click(readingCluster);
        expect(readingCluster).toHaveAttribute('aria-pressed', 'false');
    });

    it('restores a selected node into a focused insight panel', async () => {
        routeState.search = { selected: '2' };
        renderGraph();

        const selectedNote = await screen.findByRole('region', { name: 'Graph ideas' });

        expect(within(selectedNote).getByRole('heading', { name: 'Graph ideas' })).toBeInTheDocument();
        expect(within(selectedNote).getByRole('button', { name: 'Product direction' })).toBeInTheDocument();
        expect(within(selectedNote).getByRole('button', { name: 'Search notes' })).toBeInTheDocument();
        expect(within(selectedNote).getByRole('link', { name: 'Open note' })).toHaveAttribute('href', '/2');
        expect(screen.getByRole('status')).toHaveTextContent('Graph ideas selected near Graph ideas');
    });

    it('restores an isolated note with a direct open-note action', async () => {
        routeState.search = { selected: '6' };
        renderGraph();

        const selectedNote = await screen.findByRole('region', { name: 'Unlinked scratch' });

        expect(within(selectedNote).getByText('Unlinked notes')).toBeInTheDocument();
        expect(within(selectedNote).getByRole('link', { name: 'Open note' })).toHaveAttribute('href', '/6');
        expect(screen.getByRole('status')).toHaveTextContent('Unlinked scratch selected near Unlinked notes');
    });

    it('selects a connected graph node through the canvas interaction contract', async () => {
        renderGraph();

        await screen.findByTestId('force-graph');
        const node = forceGraphState.props?.graphData?.nodes.find((item) => item.id === '2');
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
        expect(routeState.navigate.mock.calls[0][0].search({})).toEqual({ selected: '2' });
    });

    it('fits the full connection map on request', async () => {
        const user = userEvent.setup();
        renderGraph();

        expect(await screen.findByTestId('force-graph')).toBeInTheDocument();
        expect(forceGraphState.props?.enableZoomInteraction?.(new MouseEvent('wheel'))).toBe(false);
        expect(forceGraphState.props?.enableZoomInteraction?.(new MouseEvent('wheel', { ctrlKey: true }))).toBe(true);

        await user.click(screen.getByRole('button', { name: 'Fit connection map' }));
        expect(forceGraphState.zoomToFit).toHaveBeenCalled();
    });

    it('keeps the empty state tied to the presence of notes', async () => {
        apiMocks.fetchNoteGraph.mockResolvedValue({
            type: 'success',
            noteGraph: {
                nodes: [],
                links: [],
            },
        });
        renderGraph();

        expect(await screen.findByText('No notes yet')).toBeInTheDocument();
    });

    it('shows an unlinked-note summary when no connections exist', async () => {
        apiMocks.fetchNoteGraph.mockResolvedValue({
            type: 'success',
            noteGraph: {
                nodes: [
                    {
                        id: '7',
                        title: 'Standalone idea',
                        connections: 0,
                        updatedAt: '1785600006000',
                        tags: [],
                    },
                    {
                        id: '8',
                        title: 'Another standalone idea',
                        connections: 0,
                        updatedAt: '1785600007000',
                        tags: [],
                    },
                ],
                links: [],
            },
        });
        renderGraph();

        expect(await screen.findByText('No connections yet')).toBeInTheDocument();
        expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument();

        expect(screen.getByText('2 notes · 0 connections')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Review notes' })).toBeInTheDocument();
    });
});
