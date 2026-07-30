import { describe, expect, it } from 'vitest';

import { getSearchShortcutLabel } from './keyboard-shortcuts';

describe('getSearchShortcutLabel', () => {
    it.each(['MacIntel', 'iPhone', 'iPad'])('uses the Command symbol on Apple platforms (%s)', (platform) => {
        expect(getSearchShortcutLabel(platform)).toBe('⌘K');
    });

    it.each(['Win32', 'Linux x86_64', ''])('uses Ctrl on non-Apple platforms (%s)', (platform) => {
        expect(getSearchShortcutLabel(platform)).toBe('Ctrl+K');
    });
});
