// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareEditorBlocks } from './external-changes';

const BLOCK_COUNT = 4_000;
const COMPARISON_BUDGET_MS = 500;

const document = (prefix: string, retainEvery?: number) =>
    JSON.stringify(
        Array.from({ length: BLOCK_COUNT }, (_, index) => ({
            id: `${prefix}-${index}`,
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text: `${retainEvery && index % retainEvery === 0 ? 'kept' : prefix} ${index}` }],
            children: [],
        })),
    );

describe('editor change comparison performance', () => {
    it.each([undefined, 20])('compares a large rewrite within budget (retained interval: %s)', (retainEvery) => {
        const before = document('before', retainEvery);
        const after = document('after', retainEvery);

        const started = performance.now();
        const { changes } = compareEditorBlocks(before, after);
        const elapsedMs = performance.now() - started;

        expect(changes).toHaveLength(BLOCK_COUNT - (retainEvery ? BLOCK_COUNT / retainEvery : 0));
        expect(changes.every((change) => change.kind === 'modified')).toBe(true);
        expect(elapsedMs).toBeLessThan(COMPARISON_BUDGET_MS);
    });
});
