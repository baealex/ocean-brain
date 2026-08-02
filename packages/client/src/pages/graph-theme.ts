import type { Theme } from '~/store/theme';

export interface GraphTheme {
    background: string;
    clusterNode: string[];
    clusterNodeDimmed: string[];
    clusterArea: string[];
    clusterAreaFocused: string[];
    clusterLabel: string[];
    nodeStroke: string;
    nodeSelectedStroke: string;
    nodeConnectedStroke: string;
    labelBackground: string;
    labelText: string;
    labelFontFamily: string;
    linkIdle: string;
    linkConnected: string;
    linkDimmed: string;
}

interface GraphNodeFillOptions {
    colorIndex: number;
    isDimmed: boolean;
}

interface GraphClusterAreaFillOptions {
    isFocused: boolean;
    isDimmed: boolean;
}

interface GraphLinkColorOptions {
    isConnected: boolean;
    isDimmed: boolean;
}

interface GraphLabelFontOptions {
    fontSize: number;
    emphasize: boolean;
}

const LIGHT_THEME: GraphTheme = {
    background: '#f2f6fa',
    clusterNode: ['#4e79a7', '#d18b47', '#5f8f76', '#c66a66', '#8064a2', '#a37a55', '#b86e91', '#4e8f9a'],
    clusterNodeDimmed: [
        'rgba(78,121,167,0.2)',
        'rgba(209,139,71,0.2)',
        'rgba(95,143,118,0.2)',
        'rgba(198,106,102,0.2)',
        'rgba(128,100,162,0.2)',
        'rgba(163,122,85,0.2)',
        'rgba(184,110,145,0.2)',
        'rgba(78,143,154,0.2)',
    ],
    clusterArea: [
        'rgba(78,121,167,0.085)',
        'rgba(209,139,71,0.085)',
        'rgba(95,143,118,0.085)',
        'rgba(198,106,102,0.085)',
        'rgba(128,100,162,0.085)',
        'rgba(163,122,85,0.085)',
        'rgba(184,110,145,0.085)',
        'rgba(78,143,154,0.085)',
    ],
    clusterAreaFocused: [
        'rgba(78,121,167,0.16)',
        'rgba(209,139,71,0.16)',
        'rgba(95,143,118,0.16)',
        'rgba(198,106,102,0.16)',
        'rgba(128,100,162,0.16)',
        'rgba(163,122,85,0.16)',
        'rgba(184,110,145,0.16)',
        'rgba(78,143,154,0.16)',
    ],
    clusterLabel: ['#3d638c', '#8b5a29', '#47715c', '#934d4a', '#614a82', '#765338', '#874d69', '#376f78'],
    nodeStroke: '#f7fafc',
    nodeSelectedStroke: '#1f3347',
    nodeConnectedStroke: '#8197aa',
    labelBackground: 'rgba(247,250,252,0.94)',
    labelText: '#1d2b39',
    labelFontFamily: 'Pretendard Variable, Pretendard, system-ui, sans-serif',
    linkIdle: 'rgba(82,112,139,0.28)',
    linkConnected: '#5e7891',
    linkDimmed: 'rgba(93,122,148,0.08)',
};

const DARK_THEME: GraphTheme = {
    background: '#111820',
    clusterNode: ['#80a9d4', '#e3aa6b', '#8db9a2', '#da918d', '#ad94cc', '#c4a17c', '#d69ab6', '#83bdc4'],
    clusterNodeDimmed: [
        'rgba(128,169,212,0.18)',
        'rgba(227,170,107,0.18)',
        'rgba(141,185,162,0.18)',
        'rgba(218,145,141,0.18)',
        'rgba(173,148,204,0.18)',
        'rgba(196,161,124,0.18)',
        'rgba(214,154,182,0.18)',
        'rgba(131,189,196,0.18)',
    ],
    clusterArea: [
        'rgba(128,169,212,0.09)',
        'rgba(227,170,107,0.09)',
        'rgba(141,185,162,0.09)',
        'rgba(218,145,141,0.09)',
        'rgba(173,148,204,0.09)',
        'rgba(196,161,124,0.09)',
        'rgba(214,154,182,0.09)',
        'rgba(131,189,196,0.09)',
    ],
    clusterAreaFocused: [
        'rgba(128,169,212,0.17)',
        'rgba(227,170,107,0.17)',
        'rgba(141,185,162,0.17)',
        'rgba(218,145,141,0.17)',
        'rgba(173,148,204,0.17)',
        'rgba(196,161,124,0.17)',
        'rgba(214,154,182,0.17)',
        'rgba(131,189,196,0.17)',
    ],
    clusterLabel: ['#9bc1e4', '#e7b77e', '#a4cbb6', '#e5aaa7', '#c1abdf', '#d1b08c', '#e0aec5', '#9acbd0'],
    nodeStroke: '#121a23',
    nodeSelectedStroke: '#eef6fc',
    nodeConnectedStroke: '#a5bed0',
    labelBackground: 'rgba(14,21,29,0.92)',
    labelText: '#edf5fb',
    labelFontFamily: 'Pretendard Variable, Pretendard, system-ui, sans-serif',
    linkIdle: 'rgba(132,158,181,0.34)',
    linkConnected: '#b0c8da',
    linkDimmed: 'rgba(121,151,177,0.08)',
};

export function getGraphTheme(theme: Theme): GraphTheme {
    return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function getGraphClusterColor(theme: Theme, colorIndex: number) {
    const palette = getGraphTheme(theme);
    return palette.clusterNode[colorIndex % palette.clusterNode.length];
}

export function getGraphNodeFill(theme: Theme, options: GraphNodeFillOptions) {
    const palette = getGraphTheme(theme);
    const colors = options.isDimmed ? palette.clusterNodeDimmed : palette.clusterNode;
    return colors[options.colorIndex % colors.length];
}

export function getGraphClusterAreaFill(theme: Theme, colorIndex: number, options: GraphClusterAreaFillOptions) {
    const palette = getGraphTheme(theme);
    if (options.isDimmed) {
        return 'transparent';
    }

    const colors = options.isFocused ? palette.clusterAreaFocused : palette.clusterArea;
    return colors[colorIndex % colors.length];
}

export function getGraphClusterLabelColor(theme: Theme, colorIndex: number) {
    const palette = getGraphTheme(theme);
    return palette.clusterLabel[colorIndex % palette.clusterLabel.length];
}

export function getGraphLinkColor(theme: Theme, options: GraphLinkColorOptions): string {
    const palette = getGraphTheme(theme);

    if (options.isDimmed) {
        return palette.linkDimmed;
    }

    return options.isConnected ? palette.linkConnected : palette.linkIdle;
}

export function getGraphLabelFont(theme: Theme, options: GraphLabelFontOptions): string {
    const palette = getGraphTheme(theme);
    const weight = options.emphasize ? '700' : '500';

    return `${weight} ${options.fontSize}px ${palette.labelFontFamily}`;
}
