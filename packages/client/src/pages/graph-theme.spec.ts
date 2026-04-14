import { describe, expect, it } from 'vitest';

import { getGraphLabelFont, getGraphLinkColor, getGraphNodeFill, getGraphTheme } from './graph-theme';

describe('getGraphTheme', () => {
    it('returns monochrome-forward light and dark palettes', () => {
        const light = getGraphTheme('light');
        const dark = getGraphTheme('dark');

        expect(light.nodeHub).toBe('#2c2f36');
        expect(light.labelFontFamily).toContain('Pretendard');
        expect(dark.background).toBe('#121316');
        expect(dark.linkIdle).toContain('rgba');
    });

    it('maps node fills through selected, connected, hub, dimmed, and default states', () => {
        expect(
            getGraphNodeFill('light', {
                connections: 2,
                colorIndex: 1,
                selectedNodeId: 'node-1',
                nodeId: 'node-1',
                isConnected: false,
            }),
        ).toBe('#111318');

        expect(
            getGraphNodeFill('light', {
                connections: 2,
                colorIndex: 1,
                selectedNodeId: 'node-1',
                nodeId: 'node-2',
                isConnected: true,
            }),
        ).toBe(getGraphTheme('light').nodeConnected);

        expect(
            getGraphNodeFill('light', {
                connections: 4,
                colorIndex: 2,
                selectedNodeId: null,
                nodeId: 'node-3',
                isConnected: false,
            }),
        ).toBe(getGraphTheme('light').nodeHub);

        expect(
            getGraphNodeFill('dark', {
                connections: 1,
                colorIndex: 3,
                selectedNodeId: 'node-1',
                nodeId: 'node-4',
                isConnected: false,
            }),
        ).toBe(getGraphTheme('dark').nodeDimmed[3]);

        expect(
            getGraphNodeFill('dark', {
                connections: 2,
                colorIndex: 0,
                selectedNodeId: null,
                nodeId: 'node-5',
                isConnected: false,
            }),
        ).toBe(getGraphTheme('dark').nodeDefault[0]);
    });

    it('maps link colors for idle, connected, and dimmed states', () => {
        expect(
            getGraphLinkColor('light', {
                selectedNodeId: null,
                isConnected: false,
            }),
        ).toBe(getGraphTheme('light').linkIdle);

        expect(
            getGraphLinkColor('light', {
                selectedNodeId: 'node-1',
                isConnected: true,
            }),
        ).toBe(getGraphTheme('light').linkConnected);

        expect(
            getGraphLinkColor('dark', {
                selectedNodeId: 'node-1',
                isConnected: false,
            }),
        ).toBe(getGraphTheme('dark').linkDimmed);
    });

    it('maps label font weights to shipped Pretendard weights', () => {
        expect(
            getGraphLabelFont('light', {
                fontSize: 12,
                emphasize: false,
            }),
        ).toBe('400 12px Pretendard Variable, Pretendard, system-ui, sans-serif');

        expect(
            getGraphLabelFont('dark', {
                fontSize: 12,
                emphasize: true,
            }),
        ).toBe('700 12px Pretendard Variable, Pretendard, system-ui, sans-serif');
    });
});
