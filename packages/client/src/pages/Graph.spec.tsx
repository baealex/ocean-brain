import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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

const virtualizerMocks = vi.hoisted(() => ({
    measureElement: vi.fn(),
    scrollToOffset: vi.fn(),
    scrollToIndex: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    getRouteApi: () => ({
        useNavigate: () => routeState.navigate,
        useSearch: () => routeState.search,
    }),
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
}));

vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: ({
        count,
        estimateSize,
        getItemKey,
    }: {
        count: number;
        estimateSize: (index: number) => number;
        getItemKey?: (index: number) => number | string | bigint;
    }) => {
        const itemSize = count > 0 ? estimateSize(0) : 0;

        return {
            getTotalSize: () => count * itemSize,
            getVirtualItems: () =>
                Array.from({ length: count }, (_, index) => ({
                    end: (index + 1) * itemSize,
                    index,
                    key: getItemKey?.(index) ?? index,
                    lane: 0,
                    size: itemSize,
                    start: index * itemSize,
                })),
            measureElement: virtualizerMocks.measureElement,
            scrollToOffset: virtualizerMocks.scrollToOffset,
            scrollToIndex: virtualizerMocks.scrollToIndex,
        };
    },
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
        routeState.navigate.mockReset();
        routeState.search = {};
        virtualizerMocks.measureElement.mockReset();
        virtualizerMocks.scrollToOffset.mockReset();
        virtualizerMocks.scrollToIndex.mockReset();
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

    it('provides a keyboard-accessible graph node list with separate selection and open actions', async () => {
        const user = userEvent.setup();
        renderGraph();

        expect(await screen.findByRole('region', { name: 'Graph Explorer' })).toBeInTheDocument();
        expect(screen.getByTestId('force-graph')).toBeInTheDocument();

        const alphaButton = screen.getByRole('button', { name: /Alpha note/ });
        const alphaOpenLink = screen.getByRole('link', { name: 'Open Alpha note' });
        expect(alphaOpenLink).toHaveAttribute('href', '/note-1');
        expect(screen.queryByRole('button', { name: /Isolated note/ })).not.toBeInTheDocument();

        await user.click(alphaButton);

        expect(routeState.navigate).toHaveBeenCalledWith({
            search: expect.any(Function),
            replace: true,
        });
        expect(routeState.navigate.mock.calls[0][0].search({})).toEqual({
            selected: 'note-1',
        });
    });

    it('restores selected graph node from the route search', async () => {
        routeState.search = { selected: 'note-2' };
        renderGraph();

        expect(await screen.findByRole('status')).toHaveTextContent('Beta note selected, 1 links');
        expect(screen.getByRole('status')).toHaveTextContent('Alpha note');

        await waitFor(() => {
            expect(virtualizerMocks.scrollToIndex).toHaveBeenCalledWith(1, {
                align: 'auto',
                behavior: 'smooth',
            });
        });

        const listItems = screen.getAllByRole('listitem');
        expect(listItems[1]).toHaveAttribute('aria-posinset', '2');
        expect(listItems[1]).toHaveAttribute('aria-setsize', '2');
    });

    it('keeps graph note rows in an accessible virtualized list', async () => {
        renderGraph();

        expect(await screen.findByRole('list', { name: 'Graph notes' })).toBeInTheDocument();
        expect(virtualizerMocks.measureElement).toHaveBeenCalled();

        const listItems = screen.getAllByRole('listitem');
        expect(listItems).toHaveLength(2);
        expect(listItems[0]).toHaveAttribute('aria-posinset', '1');
        expect(listItems[0]).toHaveAttribute('aria-setsize', '2');
        expect(listItems[1]).toHaveAttribute('aria-posinset', '2');
        expect(listItems[1]).toHaveAttribute('aria-setsize', '2');
    });

    it('provides a keyboard scroll target for virtualized graph notes', async () => {
        const user = userEvent.setup();
        apiMocks.fetchNoteGraph.mockResolvedValue({
            type: 'success',
            noteGraph: {
                nodes: Array.from({ length: 20 }, (_, index) => ({
                    id: `note-${index + 1}`,
                    title: `Note ${index + 1}`,
                    connections: 1,
                })),
                links: Array.from({ length: 19 }, (_, index) => ({
                    source: `note-${index + 1}`,
                    target: `note-${index + 2}`,
                })),
            },
        });
        renderGraph();

        const list = await screen.findByRole('list', { name: 'Graph notes' });
        expect(list).toHaveAttribute('tabindex', '0');
        expect(list).toHaveAccessibleDescription(
            '20 shown Focus the graph notes list and use arrow, page, home, or end keys to browse more results.',
        );

        list.focus();
        expect(list).toHaveFocus();

        await user.keyboard('{PageDown}');

        const [offset, options] = virtualizerMocks.scrollToOffset.mock.calls[0] ?? [];

        expect(offset).toEqual(expect.any(Number));
        expect(offset).toBeGreaterThan(0);
        expect(options).toEqual({ behavior: 'auto' });
    });

    it('filters the accessible graph node list', async () => {
        const user = userEvent.setup();
        renderGraph();

        const searchInput = await screen.findByRole('textbox', { name: 'Search graph' });
        expect(searchInput).toHaveAccessibleDescription('2 shown');

        await user.type(searchInput, 'beta');

        expect(screen.getByRole('button', { name: /Beta note/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Alpha note/ })).not.toBeInTheDocument();
        expect(searchInput).toHaveAccessibleDescription('1 shown');
        expect(virtualizerMocks.scrollToOffset).toHaveBeenCalledWith(0, { behavior: 'auto' });
    });

    it('does not let selected-node scrolling override search reset', async () => {
        routeState.search = { selected: 'note-2' };
        const user = userEvent.setup();
        renderGraph();

        expect(await screen.findByRole('status')).toHaveTextContent('Beta note selected, 1 links');
        await waitFor(() => {
            expect(virtualizerMocks.scrollToIndex).toHaveBeenCalledWith(1, {
                align: 'auto',
                behavior: 'smooth',
            });
        });

        virtualizerMocks.scrollToIndex.mockClear();
        virtualizerMocks.scrollToOffset.mockClear();

        await user.type(screen.getByRole('textbox', { name: 'Search graph' }), 'note');

        expect(screen.getByRole('button', { name: /Alpha note/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Beta note/ })).toBeInTheDocument();
        expect(virtualizerMocks.scrollToOffset).toHaveBeenCalledWith(0, { behavior: 'auto' });
        expect(virtualizerMocks.scrollToIndex).not.toHaveBeenCalled();
    });
});
