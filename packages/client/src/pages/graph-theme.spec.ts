// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
    getGraphClusterAreaFill,
    getGraphClusterColor,
    getGraphLinkColor,
    getGraphNodeFill,
    getGraphTheme,
} from './graph-theme';

describe('graph theme', () => {
    it('keeps connection colors distinct and aligned across visual states', () => {
        const light = getGraphTheme('light');
        const dark = getGraphTheme('dark');

        for (const palette of [light, dark]) {
            expect(new Set(palette.clusterNode).size).toBe(palette.clusterNode.length);
            expect(palette.clusterNode.length).toBeGreaterThan(1);
            expect(palette.clusterNodeDimmed).toHaveLength(palette.clusterNode.length);
            expect(palette.clusterArea).toHaveLength(palette.clusterNode.length);
            expect(palette.clusterAreaFocused).toHaveLength(palette.clusterNode.length);
            expect(palette.clusterLabel).toHaveLength(palette.clusterNode.length);
        }
    });

    it('keeps cluster identity while dimming nodes outside the current focus', () => {
        expect(getGraphNodeFill('light', { colorIndex: 2, isDimmed: false })).toBe(getGraphClusterColor('light', 2));
        expect(getGraphNodeFill('light', { colorIndex: 2, isDimmed: true })).toContain('rgba');
    });

    it('strengthens only the focused interest area', () => {
        expect(
            getGraphClusterAreaFill('light', 1, {
                isFocused: true,
                isDimmed: false,
            }),
        ).not.toBe(
            getGraphClusterAreaFill('light', 1, {
                isFocused: false,
                isDimmed: false,
            }),
        );
        expect(
            getGraphClusterAreaFill('light', 1, {
                isFocused: false,
                isDimmed: true,
            }),
        ).toBe('transparent');
    });

    it('maps links to idle, connected, and dimmed states', () => {
        const palette = getGraphTheme('dark');

        expect(getGraphLinkColor('dark', { isConnected: false, isDimmed: false })).toBe(palette.linkIdle);
        expect(getGraphLinkColor('dark', { isConnected: true, isDimmed: false })).toBe(palette.linkConnected);
        expect(getGraphLinkColor('dark', { isConnected: true, isDimmed: true })).toBe(palette.linkDimmed);
    });
});
