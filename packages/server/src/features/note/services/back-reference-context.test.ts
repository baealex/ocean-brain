import assert from 'node:assert/strict';
import test from 'node:test';
import { extractBackReferenceContexts } from './back-reference-context.js';

const reference = (id: string, title = 'Login redesign') => ({ type: 'reference', props: { id, title } });
const paragraph = (id: string, content: unknown[], children: unknown[] = []) => ({
    id,
    type: 'paragraph',
    content,
    children,
});
const text = (value: string) => ({ type: 'text', text: value });

test('backlink contexts identify the target by ID and retain the surrounding sentence', () => {
    const content = JSON.stringify([
        paragraph('meeting', [text('Discuss '), reference('8'), text(' and '), reference('7'), text(' next month.')]),
    ]);

    const result = extractBackReferenceContexts(content, '7');

    assert.deepEqual(result, {
        contexts: [
            {
                blockId: 'meeting',
                segments: [
                    { text: 'Discuss Login redesign and ', isTarget: false },
                    { text: 'Login redesign', isTarget: true },
                    { text: ' next month.', isTarget: false },
                ],
            },
        ],
        hasMore: false,
    });
});

test('a nested mention belongs to its own block rather than being duplicated on its parent', () => {
    const content = JSON.stringify([
        paragraph('parent', [text('Agenda')], [paragraph('child', [reference('7'), text(' is postponed.')])]),
    ]);

    const result = extractBackReferenceContexts(content, '7');

    assert.deepEqual(
        result.contexts.map((context) => context.blockId),
        ['child'],
    );
});

test('a long paragraph is cropped around the mention instead of losing it beyond the preview boundary', () => {
    const content = JSON.stringify([
        paragraph('long', [text('Earlier context. '.repeat(60)), reference('7'), text(' waits for QA. '.repeat(60))]),
    ]);

    const result = extractBackReferenceContexts(content, '7');

    assert.equal(result.contexts.length, 1);
    assert.ok(result.contexts[0].segments.some((segment) => segment.isTarget && segment.text === 'Login redesign'));
    const preview = result.contexts[0].segments.map((segment) => segment.text).join('');
    assert.ok(preview.length <= 182);
    assert.ok(preview.startsWith('…'));
    assert.ok(preview.endsWith('…'));
});

test('context extraction is bounded even when one note mentions the target repeatedly', () => {
    const content = JSON.stringify(Array.from({ length: 10 }, (_, i) => paragraph(`block-${i}`, [reference('7')])));

    const result = extractBackReferenceContexts(content, '7');

    assert.deepEqual(
        result.contexts.map((context) => context.blockId),
        ['block-0', 'block-1', 'block-2'],
    );
    assert.equal(result.hasMore, true);
});

test('legacy blocks without IDs still provide context', () => {
    const content = JSON.stringify([{ type: 'paragraph', content: [reference('7')] }]);

    const result = extractBackReferenceContexts(content, '7');

    assert.equal(result.contexts[0].blockId, null);
});

test('malformed content provides no backlink context', () => {
    const result = extractBackReferenceContexts('{broken', '7');

    assert.deepEqual(result, { contexts: [], hasMore: false });
});

test('cropping emoji context keeps valid UTF-8 text', () => {
    const content = JSON.stringify([
        paragraph('emoji', [text('x' + '😀'.repeat(100)), reference('7', '로그인 개편!'), text('😀'.repeat(100))]),
    ]);

    const result = extractBackReferenceContexts(content, '7');

    const preview = result.contexts[0].segments.map((segment) => segment.text).join('');
    assert.equal(Buffer.from(preview, 'utf8').toString('utf8'), preview);
    assert.ok(preview.length <= 182);
});

test('a mention near the end of a paragraph stays near the start of its preview', () => {
    const content = JSON.stringify([
        paragraph('ending', [text('Earlier context. '.repeat(8)), reference('7'), text(' is next.')]),
    ]);

    const result = extractBackReferenceContexts(content, '7');

    const preview = result.contexts[0].segments.map((segment) => segment.text).join('');
    assert.ok(preview.indexOf('Login redesign') <= 33);
    assert.ok(preview.endsWith(' is next.'));
});
