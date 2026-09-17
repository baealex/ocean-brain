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
});
