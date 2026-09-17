import assert from 'node:assert/strict';
import test from 'node:test';
import { readMarkdownRange } from './markdown-read.js';

const version = new Date('2026-09-17T00:00:00Z');

test('markdown pages cover Korean and emoji without splitting UTF-16 pairs', () => {
    const markdown = '가🙂나🚀끝';
    let offset = 0;
    let combined = '';
    do {
        const page = readMarkdownRange(markdown, version, {
            offset,
            maxLength: 1,
            expectedUpdatedAt: version.toISOString(),
        });
        assert.equal(page.status, 'read');
        combined += page.markdown;
        assert.ok(page.contentRange);
        assert.ok(page.contentRange.end > offset);
        offset = page.contentRange.nextOffset ?? markdown.length;
    } while (offset < markdown.length);
    assert.equal(combined, markdown);
    assert.equal(readMarkdownRange(markdown, version, { offset: 999 }).markdown, '');
    assert.equal(readMarkdownRange('', version, {}).contentRange?.nextOffset, null);
    assert.equal(readMarkdownRange(markdown, version, { offset: 3, maxLength: 0 }).markdown, '나🚀끝');
});

test('heading reads include subsections, ignore fenced headings, and expose ambiguous positions', () => {
    const markdown = '# First\nBody\n```md\n# Target\n```\n# Target\nChosen\n## Child\nNested\n# Last\nEnd';
    const page = readMarkdownRange(markdown, version, { heading: 'Target', maxLength: 0 });
    assert.equal(page.markdown, '# Target\nChosen\n## Child\nNested\n');
    assert.equal(page.contentRange?.sectionEnd, markdown.indexOf('# Last'));
    const ambiguous = readMarkdownRange('# Same\nA\n# Same\nB', version, { heading: 'Same' });
    assert.equal(ambiguous.status, 'needs_disambiguation');
    assert.deepEqual(
        ambiguous.candidates.map((candidate) => candidate.start),
        [0, 9],
    );
    assert.equal(readMarkdownRange(markdown, version, { heading: 'Missing' }).reason, 'HEADING_NOT_FOUND');
    assert.throws(() => readMarkdownRange(markdown, version, { offset: 0, heading: 'Target' }), /either/);
});

test('changed or invalid expected versions cannot yield mixed document pages', () => {
    for (const expectedUpdatedAt of ['invalid', '2026-09-16T00:00:00Z']) {
        const result = readMarkdownRange('Current private body', version, { offset: 3, expectedUpdatedAt });
        assert.equal(result.reason, 'NOTE_VERSION_CONFLICT');
        assert.equal(result.markdown, '');
    }
    assert.equal(readMarkdownRange('body', version, { expectedUpdatedAt: String(version.getTime()) }).status, 'read');
});
