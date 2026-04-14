import { hasExactTagMatch } from './tag-match';

describe('hasExactTagMatch', () => {
    it('returns true when the fetched tags already contain the exact tag name', () => {
        expect(hasExactTagMatch('project', [
            { name: '@project' },
            { name: '@project-archive' }
        ])).toBe(true);
    });

    it('returns false when the fetched tags only contain partial matches', () => {
        expect(hasExactTagMatch('project', [
            { name: '@project-archive' },
            { name: '@project-next' }
        ])).toBe(false);
    });
});
