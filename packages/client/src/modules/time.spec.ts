// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getRecentTimeSinceRefreshDelay, recentTimeSince, timeSince } from './time';

describe('timeSince', () => {
    it('formats elapsed time using the provided current time', () => {
        expect(timeSince(1_770_000_000_000, 1_770_000_065_000)).toBe('1 minute ago');
        expect(timeSince(1_770_000_000_000, 1_770_000_125_000)).toBe('2 minutes ago');
    });

    it('does not return negative elapsed time for future timestamps', () => {
        expect(timeSince(1_770_000_010_000, 1_770_000_000_000)).toBe('0 seconds ago');
    });
});

describe('recentTimeSince', () => {
    it('uses just now for the first minute', () => {
        expect(recentTimeSince(1_770_000_000_000, 1_770_000_059_000)).toBe('just now');
        expect(recentTimeSince(null, 1_770_000_059_000)).toBe('just now');
        expect(recentTimeSince(1_770_000_010_000, 1_770_000_000_000)).toBe('just now');
    });

    it('uses minute-based relative time after the first minute', () => {
        expect(recentTimeSince(1_770_000_000_000, 1_770_000_060_000)).toBe('1 minute ago');
    });

    it('returns the next meaningful refresh delay', () => {
        expect(getRecentTimeSinceRefreshDelay(1_770_000_000_000, 1_770_000_010_000)).toBe(50_000);
        expect(getRecentTimeSinceRefreshDelay(1_770_000_000_000, 1_770_000_070_000)).toBe(50_000);
    });
});
