import { findUnchangedBlock, getNoteContentChanges, getNoteReview, getReviewText } from './note-content-changes';

const content = (...texts: string[]) =>
    JSON.stringify(
        texts.map((text, index) => ({
            id: `block-${index}`,
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text, styles: {} }],
            children: [],
        })),
    );

describe('getNoteContentChanges', () => {
    it('finds the reading anchor after IDs change and a paragraph is inserted above it', () => {
        expect(findUnchangedBlock(content('a', 'b'), content('new', 'a', 'b'), 'block-1')).toBe('block-2');
    });
    it('includes reference target changes even when their visible titles match', () => {
        const reference = (id: string) =>
            JSON.stringify([
                {
                    id: 'paragraph',
                    type: 'paragraph',
                    props: {},
                    children: [],
                    content: [{ type: 'reference', props: { id, title: 'Same title' } }],
                },
            ]);
        expect(getNoteContentChanges(reference('1'), reference('2'))).toEqual({
            blockIds: ['paragraph'],
            deletedCount: 0,
        });
    });
    it('ignores regenerated IDs on unchanged paragraphs after an insertion', () => {
        expect(getNoteContentChanges(content('a', 'b'), content('new', 'a', 'b'))).toEqual({
            blockIds: ['block-0'],
            deletedCount: 0,
        });
    });
    it('marks separate modified paragraphs without marking unchanged paragraphs', () => {
        expect(getNoteContentChanges(content('a', 'b', 'c'), content('A', 'b', 'C'))).toEqual({
            blockIds: ['block-0', 'block-2'],
            deletedCount: 0,
        });
    });
    it('reports deleted paragraphs even without a remaining highlight target', () => {
        expect(getNoteContentChanges(content('a', 'b', 'c'), content('a', 'c'))).toEqual({
            blockIds: [],
            deletedCount: 1,
        });
    });
    it('handles repeated paragraphs and an empty document', () => {
        expect(getNoteContentChanges(content('a', 'a'), content('a'))).toEqual({ blockIds: [], deletedCount: 1 });
        expect(getNoteContentChanges(content('a'), '[]')).toEqual({ blockIds: [], deletedCount: 1 });
    });

    it('does not pair a deleted paragraph with an updated checklist', () => {
        const block = (id: string, type: string, text: string) => ({
            id,
            type,
            props: type === 'checkListItem' ? { checked: false } : {},
            content: [{ type: 'text', text, styles: {} }],
            children: [],
        });
        const before = JSON.stringify([
            block('intro-before', 'paragraph', 'Intro'),
            block('remove-before', 'paragraph', 'Remove this'),
            block('check-before', 'checkListItem', 'Old task'),
            block('outro-before', 'paragraph', 'Outro'),
        ]);
        const after = JSON.stringify([
            block('intro-after', 'paragraph', 'Intro'),
            block('check-after', 'checkListItem', 'Updated task'),
            block('outro-after', 'paragraph', 'Outro'),
        ]);

        const review = getNoteReview(before, after);
        expect(review.map(({ kind }) => kind)).toEqual(['deleted', 'modified']);
        expect(getReviewText(review[0].before)).toBe('Remove this');
        expect(getReviewText(review[1].before)).toBe('☐ Old task');
        expect(getReviewText(review[1].after)).toBe('☐ Updated task');
    });

    it('presents a structural replacement as a removal and an addition', () => {
        const block = (id: string, type: string, text: string) => ({
            id,
            type,
            props: type === 'heading' ? { level: 2 } : {},
            content: [{ type: 'text', text, styles: {} }],
            children: [],
        });
        const review = getNoteReview(
            JSON.stringify([block('before', 'paragraph', 'Plain text')]),
            JSON.stringify([block('after', 'heading', 'Now a heading')]),
        );

        expect(review.map(({ kind }) => kind)).toEqual(['deleted', 'added']);
        expect(getReviewText(review[0].before)).toBe('Plain text');
        expect(getReviewText(review[1].after)).toBe('Now a heading');
    });
});
