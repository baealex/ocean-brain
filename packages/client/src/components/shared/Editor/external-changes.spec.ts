import { compareEditorBlocks } from './external-changes';

const block = (id: string, text: string, children: unknown[] = []) => ({
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }],
    children,
});

describe('editor change awareness', () => {
    it('does not highlight untouched content when MCP regenerates every block id', () => {
        const before = JSON.stringify([block('a', 'Keep'), block('b', 'Old'), block('c', 'End')]);
        const after = JSON.stringify([block('x', 'Keep'), block('y', 'New'), block('z', 'End')]);
        expect(compareEditorBlocks(before, after)).toEqual({ changes: [{ id: 'y', kind: 'modified' }] });
    });

    it('ignores removed blocks and marks only added survivors', () => {
        const before = JSON.stringify([block('a', 'Keep'), block('b', 'Remove'), block('c', 'End')]);
        const after = JSON.stringify([block('a', 'Keep'), block('c', 'End'), block('d', 'Added')]);
        expect(compareEditorBlocks(before, after)).toEqual({
            changes: [{ id: 'd', kind: 'added' }],
        });
    });

    it('does not mark unchanged text when the update only deletes a block', () => {
        const before = JSON.stringify([block('a', 'Keep'), block('b', 'Remove'), block('c', 'End')]);
        const after = JSON.stringify([block('x', 'Keep'), block('y', 'End')]);
        expect(compareEditorBlocks(before, after)).toEqual({ changes: [] });
    });

    it('marks a nested edit without highlighting its unchanged parent', () => {
        const before = JSON.stringify([block('a', 'Parent', [block('b', 'Old')])]);
        const after = JSON.stringify([block('a', 'Parent', [block('b', 'New')])]);
        expect(compareEditorBlocks(before, after).changes).toEqual([{ id: 'b', kind: 'modified' }]);
    });

    it('recognizes formatting changes but ignores object key order', () => {
        const before = block('a', 'Text');
        const after = { ...before, content: [{ text: 'Text', styles: { bold: true }, type: 'text' }] };
        expect(compareEditorBlocks(JSON.stringify([before]), JSON.stringify([after])).changes).toEqual([
            { id: 'a', kind: 'modified' },
        ]);
        expect(
            compareEditorBlocks(
                JSON.stringify([before]),
                JSON.stringify([{ ...before, content: [{ styles: {}, text: 'Text', type: 'text' }] }]),
            ).changes,
        ).toEqual([]);
    });

    it('keeps repeated unchanged blocks unmarked during a large rewrite', () => {
        const before = Array.from({ length: 600 }, (_, i) => block(`old-${i}`, i % 20 === 0 ? 'Keep' : `Old ${i}`));
        const after = Array.from({ length: 600 }, (_, i) => block(`new-${i}`, i % 20 === 0 ? 'Keep' : `New ${i}`));

        const { changes } = compareEditorBlocks(JSON.stringify(before), JSON.stringify(after));

        expect(changes).toEqual(after.filter((_, i) => i % 20 !== 0).map(({ id }) => ({ id, kind: 'modified' })));
    });

    it('marks an extra repeated paragraph instead of matching an earlier occurrence twice', () => {
        const before = Array.from({ length: 600 }, (_, i) => block(`old-${i}`, i % 20 === 0 ? 'Keep' : `Remove ${i}`));
        const after = [...Array.from({ length: 30 }, (_, i) => block(`new-${i}`, 'Keep')), block('extra', 'Keep')];

        const { changes } = compareEditorBlocks(JSON.stringify(before), JSON.stringify(after));

        expect(changes).toEqual([{ id: 'extra', kind: 'modified' }]);
    });

    it('marks edits to retained block IDs after a large rewrite and distinguishes appended content', () => {
        const before = [
            ...Array.from({ length: 600 }, (_, i) => block(`old-${i}`, `Old ${i}`)),
            block('retained', 'Old ending'),
        ];
        const after = [
            ...Array.from({ length: 600 }, (_, i) => block(`new-${i}`, `New ${i}`)),
            block('retained', 'New ending'),
            block('added', 'Extra paragraph'),
        ];

        const { changes } = compareEditorBlocks(JSON.stringify(before), JSON.stringify(after));

        expect(changes).toHaveLength(602);
        expect(changes.slice(-2)).toEqual([
            { id: 'retained', kind: 'modified' },
            { id: 'added', kind: 'added' },
        ]);
    });

    it.each([
        false,
        true,
    ])('marks only a large prefix insertion containing copied text (regenerated IDs: %s)', (regenerateIds) => {
        const before = Array.from({ length: 200 }, (_, i) => block(`kept-${i}`, `Paragraph ${i}`));
        const inserted = [
            block('new-copy', 'Paragraph 199'),
            ...Array.from({ length: 129 }, (_, i) => block(`new-${i}`, `Inserted ${i}`)),
        ];
        const after = [
            ...inserted,
            ...before.map((value, i) => ({ ...value, id: regenerateIds ? `regenerated-${i}` : value.id })),
        ];

        const { changes } = compareEditorBlocks(JSON.stringify(before), JSON.stringify(after));

        expect(changes).toEqual(inserted.map(({ id }) => ({ id, kind: 'added' })));
    });
});
