import { describe, expect, it } from 'vitest';

import { filterReferenceSuggestionNotes } from './reference-suggestions';

describe('filterReferenceSuggestionNotes', () => {
    it('excludes the currently edited note from reference suggestions', () => {
        expect(
            filterReferenceSuggestionNotes(
                [
                    { id: '1', title: 'Current note' },
                    { id: '2', title: 'Another note' },
                ],
                '1',
            ),
        ).toEqual([{ id: '2', title: 'Another note' }]);
    });

    it('returns the original list when there is no current note id', () => {
        const notes = [
            { id: '1', title: 'Current note' },
            { id: '2', title: 'Another note' },
        ];

        expect(filterReferenceSuggestionNotes(notes)).toEqual(notes);
    });
});
