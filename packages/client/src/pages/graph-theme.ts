import type { Theme } from '~/store/theme';

export interface GraphTheme {
    background: string;
    nodeHub: string;
    nodeSelected: string;
    nodeConnected: string;
    nodeDefault: string[];
    nodeDimmed: string[];
    nodeHubDimmed: string;
    nodeStroke: string;
    nodeSelectedStroke: string;
    labelBackground: string;
    labelText: string;
    labelFontFamily: string;
    linkIdle: string;
    linkConnected: string;
    linkDimmed: string;
    legendHub: string;
}

interface GraphNodeFillOptions {
    connections: number;
    colorIndex: number;
    selectedNodeId: string | null;
    nodeId: string;
    isConnected: boolean;
}

interface GraphLinkColorOptions {
    selectedNodeId: string | null;
    isConnected: boolean;
}

interface GraphLabelFontOptions {
    fontSize: number;
    emphasize: boolean;
}

const LIGHT_THEME: GraphTheme = {
    background: '#f4f6f8',
    nodeHub: '#2c2f36',
    nodeSelected: '#111318',
    nodeConnected: '#636b76',
    nodeDefault: ['#d6dbe1', '#c8ced6', '#b7bec7', '#a7afb9'],
    nodeDimmed: ['rgba(214,219,225,0.28)', 'rgba(200,206,214,0.24)', 'rgba(183,190,199,0.24)', 'rgba(167,175,185,0.2)'],
    nodeHubDimmed: 'rgba(44,47,54,0.16)',
    nodeStroke: '#eef1f4',
    nodeSelectedStroke: '#a6b0bc',
    labelBackground: 'rgba(246,248,250,0.92)',
    labelText: '#222831',
    labelFontFamily: 'Pretendard Variable, Pretendard, system-ui, sans-serif',
    linkIdle: 'rgba(99, 107, 117, 0.34)',
    linkConnected: '#68717c',
    linkDimmed: 'rgba(127, 136, 146, 0.12)',
    legendHub: '#2c2f36',
};

const DARK_THEME: GraphTheme = {
    background: '#121316',
    nodeHub: '#d6dce3',
    nodeSelected: '#eef1f5',
    nodeConnected: '#9099a4',
    nodeDefault: ['#343a43', '#2d333c', '#262c35', '#20262f'],
    nodeDimmed: ['rgba(52,58,67,0.28)', 'rgba(45,51,60,0.24)', 'rgba(38,44,53,0.22)', 'rgba(32,38,47,0.2)'],
    nodeHubDimmed: 'rgba(214,220,227,0.16)',
    nodeStroke: '#171c23',
    nodeSelectedStroke: '#7f8a97',
    labelBackground: 'rgba(16,18,22,0.9)',
    labelText: '#eef2f6',
    labelFontFamily: 'Pretendard Variable, Pretendard, system-ui, sans-serif',
    linkIdle: 'rgba(118, 127, 138, 0.42)',
    linkConnected: '#a2abb6',
    linkDimmed: 'rgba(118, 127, 138, 0.1)',
    legendHub: '#d6dce3',
};

const GRAPH_VARIABLES = {
    background: '--ob-graph-background',
    nodeHub: '--ob-graph-node-hub',
    nodeSelected: '--ob-graph-node-selected',
    nodeConnected: '--ob-graph-node-connected',
    nodeHubDimmed: '--ob-graph-node-hub-dimmed',
    nodeStroke: '--ob-graph-node-stroke',
    nodeSelectedStroke: '--ob-graph-node-selected-stroke',
    labelBackground: '--ob-graph-label-background',
    labelText: '--ob-graph-label-text',
    linkIdle: '--ob-graph-link-idle',
    linkConnected: '--ob-graph-link-connected',
    linkDimmed: '--ob-graph-link-dimmed',
    legendHub: '--ob-graph-legend-hub',
} as const;

function readThemeVariable(styles: CSSStyleDeclaration, name: string, fallback: string) {
    return styles.getPropertyValue(name).trim() || fallback;
}

function readGraphTheme(fallback: GraphTheme): GraphTheme {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
    const styles = getComputedStyle(document.documentElement);
    const read = <Key extends keyof typeof GRAPH_VARIABLES>(key: Key) =>
        readThemeVariable(styles, GRAPH_VARIABLES[key], fallback[key]);
    const readArray = (prefix: string, values: string[]) =>
        values.map((value, index) => readThemeVariable(styles, `${prefix}-${index + 1}`, value));

    return {
        background: read('background'),
        nodeHub: read('nodeHub'),
        nodeSelected: read('nodeSelected'),
        nodeConnected: read('nodeConnected'),
        nodeDefault: readArray('--ob-graph-node-default', fallback.nodeDefault),
        nodeDimmed: readArray('--ob-graph-node-dimmed', fallback.nodeDimmed),
        nodeHubDimmed: read('nodeHubDimmed'),
        nodeStroke: read('nodeStroke'),
        nodeSelectedStroke: read('nodeSelectedStroke'),
        labelBackground: read('labelBackground'),
        labelText: read('labelText'),
        labelFontFamily: readThemeVariable(styles, '--ob-font-graph', fallback.labelFontFamily),
        linkIdle: read('linkIdle'),
        linkConnected: read('linkConnected'),
        linkDimmed: read('linkDimmed'),
        legendHub: read('legendHub'),
    };
}

export function getGraphTheme(theme: Theme): GraphTheme {
    return readGraphTheme(theme === 'dark' ? DARK_THEME : LIGHT_THEME);
}

export function getGraphNodeFill(palette: GraphTheme, options: GraphNodeFillOptions): string {
    const { connections, colorIndex, selectedNodeId, nodeId, isConnected } = options;

    const isSelected = selectedNodeId === nodeId;
    const isDimmed = selectedNodeId !== null && !isSelected && !isConnected;

    if (isDimmed) {
        return connections > 3 ? palette.nodeHubDimmed : palette.nodeDimmed[colorIndex % palette.nodeDimmed.length];
    }

    if (isSelected) {
        return palette.nodeSelected;
    }

    if (isConnected) {
        return palette.nodeConnected;
    }

    if (connections > 3) {
        return palette.nodeHub;
    }

    return palette.nodeDefault[colorIndex % palette.nodeDefault.length];
}

export function getGraphLinkColor(palette: GraphTheme, options: GraphLinkColorOptions): string {
    if (options.selectedNodeId !== null && !options.isConnected) {
        return palette.linkDimmed;
    }

    if (options.isConnected) {
        return palette.linkConnected;
    }

    return palette.linkIdle;
}

export function getGraphLabelFont(palette: GraphTheme, options: GraphLabelFontOptions): string {
    const weight = options.emphasize ? '700' : '400';

    return `${weight} ${options.fontSize}px ${palette.labelFontFamily}`;
}
