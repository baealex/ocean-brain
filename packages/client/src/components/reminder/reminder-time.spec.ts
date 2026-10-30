// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatReminderTimeRemaining } from './reminder-time';

const NOW = 1_770_000_000_000;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatReminderTimeRemaining', () => {
    it.each([
        { remaining: -MINUTE, expected: 'Overdue' },
        { remaining: 30 * SECOND, expected: '<1m remaining' },
        { remaining: 45 * MINUTE, expected: '45m remaining' },
        { remaining: 5 * HOUR, expected: '5h remaining' },
        { remaining: 5 * HOUR + 12 * MINUTE, expected: '5h 12m remaining' },
        { remaining: 23 * HOUR + 59 * MINUTE, expected: '23h 59m remaining' },
        { remaining: DAY, expected: '1d remaining' },
        { remaining: 47 * HOUR + 59 * MINUTE, expected: '1d 23h remaining' },
        { remaining: 2 * DAY + 3 * HOUR + 10 * MINUTE, expected: '2d 3h remaining' },
    ])('formats $remaining ms as "$expected"', ({ remaining, expected }) => {
        expect(formatReminderTimeRemaining(NOW + remaining, NOW)).toBe(expected);
    });
});
