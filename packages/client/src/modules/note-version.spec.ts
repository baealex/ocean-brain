import { compareNoteVersions, toNoteVersionTime } from './note-version';

describe('note version ordering', () => {
    it.each([
        ['1770000000000', 1770000000000],
        ['2026-02-02T02:40:00.000Z', Date.parse('2026-02-02T02:40:00.000Z')],
        ['not-a-version', null],
    ])('parses %s as a comparable timestamp', (version, expected) => {
        expect(toNoteVersionTime(version)).toBe(expected);
    });

    it('orders timestamp and ISO versions chronologically', () => {
        expect(compareNoteVersions('1770000001000', '1770000000000')).toBeGreaterThan(0);
        expect(compareNoteVersions('2026-02-02T02:40:00.000Z', '2026-02-02T02:40:01.000Z')).toBeLessThan(0);
    });

    it('only treats identical invalid versions as equal', () => {
        expect(compareNoteVersions('invalid', 'invalid')).toBe(0);
        expect(compareNoteVersions('invalid-a', 'invalid-b')).toBeNull();
    });
});
