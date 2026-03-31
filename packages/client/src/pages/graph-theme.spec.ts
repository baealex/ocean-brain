import { describe, expect, it } from 'vitest';

import { getGraphTheme } from './graph-theme';

describe('getGraphTheme', () => {
    it('returns monochrome-forward light and dark palettes', () => {
        const light = getGraphTheme('light');
        const dark = getGraphTheme('dark');

        expect(light.nodeHub).toBe('#2c2f36');
        expect(light.labelFontFamily).toContain('Pretendard');
        expect(dark.background).toBe('#121316');
        expect(dark.linkIdle).toContain('rgba');
    });
});
