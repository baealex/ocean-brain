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
    background: '#f3f1ec',
    nodeHub: '#2c2f36',
    nodeSelected: '#111318',
    nodeConnected: '#5a606b',
    nodeDefault: ['#d8d4cc', '#c9c5bd', '#b8b4ac', '#a7a49d'],
    nodeDimmed: [
        'rgba(216,212,204,0.28)',
        'rgba(201,197,189,0.24)',
        'rgba(184,180,172,0.24)',
        'rgba(167,164,157,0.2)'
    ],
    nodeHubDimmed: 'rgba(44,47,54,0.18)',
    nodeStroke: '#f8f6f1',
    nodeSelectedStroke: '#ddd7cc',
    labelBackground: 'rgba(249,247,242,0.9)',
    labelText: '#21242b',
    labelFontFamily: 'Pretendard Variable, Pretendard, system-ui, sans-serif',
    linkIdle: 'rgba(92, 99, 110, 0.38)',
    linkConnected: '#4f5560',
    linkDimmed: 'rgba(124, 129, 137, 0.12)',
    legendHub: '#2c2f36'
};

const DARK_THEME: GraphTheme = {
    background: '#121316',
    nodeHub: '#d7d3ca',
    nodeSelected: '#f4f1e8',
    nodeConnected: '#8b919c',
    nodeDefault: ['#3a3d43', '#32353b', '#2a2d33', '#23262c'],
    nodeDimmed: [
        'rgba(58,61,67,0.28)',
        'rgba(50,53,59,0.24)',
        'rgba(42,45,51,0.22)',
        'rgba(35,38,44,0.2)'
    ],
    nodeHubDimmed: 'rgba(215,211,202,0.18)',
    nodeStroke: '#1b1d22',
    nodeSelectedStroke: '#8b919c',
    labelBackground: 'rgba(18,19,22,0.88)',
    labelText: '#f5f3ed',
    labelFontFamily: 'Pretendard Variable, Pretendard, system-ui, sans-serif',
    linkIdle: 'rgba(112, 118, 128, 0.44)',
    linkConnected: '#a8afb9',
    linkDimmed: 'rgba(112, 118, 128, 0.1)',
    legendHub: '#d7d3ca'
};

export function getGraphTheme(theme: Theme): GraphTheme {
    return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function getGraphNodeFill(theme: Theme, options: GraphNodeFillOptions): string {
    const palette = getGraphTheme(theme);
    const {
        connections,
        colorIndex,
        selectedNodeId,
        nodeId,
        isConnected
    } = options;

    const isSelected = selectedNodeId === nodeId;
    const isDimmed = selectedNodeId !== null && !isSelected && !isConnected;

    if (isDimmed) {
        return connections > 3
            ? palette.nodeHubDimmed
            : palette.nodeDimmed[colorIndex % palette.nodeDimmed.length];
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

export function getGraphLinkColor(theme: Theme, options: GraphLinkColorOptions): string {
    const palette = getGraphTheme(theme);

    if (options.selectedNodeId !== null && !options.isConnected) {
        return palette.linkDimmed;
    }

    if (options.isConnected) {
        return palette.linkConnected;
    }

    return palette.linkIdle;
}

export function getGraphLabelFont(theme: Theme, options: GraphLabelFontOptions): string {
    const palette = getGraphTheme(theme);
    const weight = options.emphasize ? '700' : '400';

    return `${weight} ${options.fontSize}px ${palette.labelFontFamily}`;
}
