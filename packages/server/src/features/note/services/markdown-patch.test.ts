import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildMarkdownAppendPlan,
    buildMarkdownPatchPlan,
    buildMarkdownReplacePlan,
    countExplicitTagTokens,
    countMarkdownReferenceTokens,
    previewMarkdownPatch,
} from './markdown-patch.js';

const note = {
    id: '1427',
    title: 'Patch baseline',
    updatedAt: '2026-05-28T00:00:00.000Z',
};

test('markdown patch preview returns a dry-run diff when exact text is unique', () => {
    const result = previewMarkdownPatch({
        note: {
            ...note,
            markdown: 'Goal\n\nOriginal sentence.\n\nDone',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Replace one specific sentence',
        selector: {
            type: 'exact_text',
            text: 'Original sentence.',
        },
        operation: {
            type: 'replace',
            replacement: 'Updated sentence.',
        },
    });

    assert.equal(result.status, 'dry_run');

    if (result.status !== 'dry_run') {
        throw new Error('expected dry_run result');
    }

    assert.ok(result.match);
    assert.deepEqual(result.note, note);
    assert.deepEqual(result.match, {
        count: 1,
        lineStart: 3,
        lineEnd: 3,
        selectorType: 'exact_text',
        matchedTextSha256: result.match.matchedTextSha256,
        surroundingHash: result.match.surroundingHash,
    });
    assert.equal(result.match.matchedTextSha256.length, 64);
    assert.equal(result.match.surroundingHash.length, 64);
    assert.equal(result.proposed.changedLineCount, 1);
    assert.equal(result.proposed.changedCharCount, 'Original sentence.'.length + 'Updated sentence.'.length);
    assert.equal(result.proposed.beforeMarkdownSha256.length, 64);
    assert.equal(result.proposed.afterMarkdownSha256.length, 64);
    assert.match(result.proposed.diff, /-Original sentence\./);
    assert.match(result.proposed.diff, /\+Updated sentence\./);
    assert.deepEqual(result.warnings, []);
});

test('markdown patch preview fails when exact text is missing', () => {
    const result = previewMarkdownPatch({
        note: {
            ...note,
            markdown: 'Goal\n\nDifferent sentence.',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Try to replace a missing sentence',
        selector: {
            type: 'exact_text',
            text: 'Original sentence.',
        },
        operation: {
            type: 'replace',
            replacement: 'Updated sentence.',
        },
    });

    assert.deepEqual(result, {
        status: 'failed',
        reason: 'TARGET_NOT_FOUND',
        message: 'No exact text match was found in the current note.',
    });
});

test('markdown patch preview accepts epoch millisecond baselines from GraphQL clients', () => {
    const result = previewMarkdownPatch({
        note: {
            ...note,
            markdown: 'Original sentence.',
        },
        expectedUpdatedAt: String(Date.parse(note.updatedAt)),
        intent: 'Replace one sentence',
        selector: {
            type: 'exact_text',
            text: 'Original sentence.',
        },
        operation: {
            type: 'replace',
            replacement: 'Updated sentence.',
        },
    });

    assert.equal(result.status, 'dry_run');
});

test('markdown token counters scan malformed bracket-heavy input without regex backtracking', () => {
    const noisyMarkdown = `${'[['.repeat(10_000)} [@project] [[Reference]] [#topic]`;

    assert.equal(countExplicitTagTokens(noisyMarkdown), 2);
    assert.equal(countMarkdownReferenceTokens(noisyMarkdown), 1);
});

test('markdown patch preview requires disambiguation when exact text appears more than once', () => {
    const result = previewMarkdownPatch({
        note: {
            ...note,
            markdown: 'Review\n\nMiddle content\n\nReview',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Replace only the final review line',
        selector: {
            type: 'exact_text',
            text: 'Review',
        },
        operation: {
            type: 'replace',
            replacement: 'Summary',
        },
    });

    assert.equal(result.status, 'needs_disambiguation');

    if (result.status !== 'needs_disambiguation') {
        throw new Error('expected needs_disambiguation result');
    }

    assert.equal(result.reason, 'TARGET_AMBIGUOUS');
    assert.equal(result.matches.length, 2);
    assert.deepEqual(
        result.matches.map((match) => ({
            matchIndex: match.matchIndex,
            lineStart: match.lineStart,
            lineEnd: match.lineEnd,
            text: match.text,
            positionHint: match.positionHint,
        })),
        [
            {
                matchIndex: 0,
                lineStart: 1,
                lineEnd: 1,
                text: 'Review',
                positionHint: 'first',
            },
            {
                matchIndex: 1,
                lineStart: 5,
                lineEnd: 5,
                text: 'Review',
                positionHint: 'last',
            },
        ],
    );
    assert.equal(result.matches[0]?.matchSha256.length, 64);
    assert.equal(result.matches[1]?.matchSha256.length, 64);
    assert.equal(result.matches[0]?.surroundingHash.length, 64);
    assert.equal(result.matches[1]?.surroundingHash.length, 64);
    assert.notEqual(result.matches[0]?.surroundingHash, result.matches[1]?.surroundingHash);
    assert.equal(result.matches[0]?.afterExcerpt, 'Middle content\n\nReview');
    assert.equal(result.matches[1]?.beforeExcerpt, 'Review\n\nMiddle content');
});

test('markdown patch plan replaces a selected duplicate match candidate only', () => {
    const firstPreview = previewMarkdownPatch({
        note: {
            ...note,
            markdown: 'Review\n\nMiddle content\n\nReview',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Replace only the final review line',
        selector: {
            type: 'exact_text',
            text: 'Review',
        },
        operation: {
            type: 'replace',
            replacement: 'Summary',
        },
    });

    assert.equal(firstPreview.status, 'needs_disambiguation');

    if (firstPreview.status !== 'needs_disambiguation') {
        throw new Error('expected needs_disambiguation result');
    }

    const selected = firstPreview.matches[1];

    assert.ok(selected);

    const result = buildMarkdownPatchPlan({
        note: {
            ...note,
            markdown: 'Review\n\nMiddle content\n\nReview',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Replace only the final review line',
        selector: {
            type: 'match_candidate',
            text: selected.text,
            matchIndex: selected.matchIndex,
            lineStart: selected.lineStart,
            matchSha256: selected.matchSha256,
            surroundingHash: selected.surroundingHash,
            positionHint: selected.positionHint,
        },
        operation: {
            type: 'replace',
            replacement: 'Summary',
        },
    });

    assert.equal(result.status, 'dry_run');

    if (result.status !== 'dry_run') {
        throw new Error('expected dry_run result');
    }

    assert.equal(result.afterMarkdown, 'Review\n\nMiddle content\n\nSummary');
});

test('markdown patch plan fails when match candidate context changed', () => {
    const result = buildMarkdownPatchPlan({
        note: {
            ...note,
            markdown: 'Review\n\nChanged content\n\nReview',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Replace only the final review line',
        selector: {
            type: 'match_candidate',
            text: 'Review',
            matchIndex: 1,
            lineStart: 5,
            matchSha256: 'bad',
            surroundingHash: 'bad',
            positionHint: 'last',
        },
        operation: {
            type: 'replace',
            replacement: 'Summary',
        },
    });

    assert.deepEqual(result, {
        status: 'failed',
        reason: 'CANDIDATE_MISMATCH',
        message: 'The selected match candidate no longer matches the current note context.',
    });
});

test('markdown append plan appends at the end without replacing existing body', () => {
    const result = buildMarkdownAppendPlan({
        note: {
            ...note,
            markdown: 'Existing body',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Append a log entry at the end',
        insertion: '- New log [@MCP]',
        placement: { type: 'end' },
    });

    assert.equal(result.status, 'dry_run');

    if (result.status !== 'dry_run') {
        throw new Error('expected dry_run result');
    }

    assert.equal(result.afterMarkdown, 'Existing body\n\n- New log [@MCP]');
});

test('markdown append plan fails when the heading is ambiguous', () => {
    const result = buildMarkdownAppendPlan({
        note: {
            ...note,
            markdown: '## Test Criteria\n\nA\n\n## Test Criteria\n\nB',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Append an item under Test Criteria',
        insertion: '- New case',
        placement: {
            type: 'after_heading',
            heading: 'Test Criteria',
            level: 2,
        },
    });

    assert.deepEqual(result, {
        status: 'failed',
        reason: 'HEADING_AMBIGUOUS',
        message: 'The requested heading appears more than once.',
    });
});

test('markdown replace plan returns a full diff for whole-note overwrite', () => {
    const result = buildMarkdownReplacePlan({
        note: {
            ...note,
            markdown: 'A\nB\nC',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: 'Rewrite the entire document structure',
        replacement: 'X\nY',
    });

    assert.equal(result.status, 'dry_run');

    if (result.status !== 'dry_run') {
        throw new Error('expected dry_run result');
    }

    assert.match(result.proposed.diff, /-A/);
    assert.match(result.proposed.diff, /-B/);
    assert.match(result.proposed.diff, /-C/);
    assert.match(result.proposed.diff, /\+X/);
    assert.match(result.proposed.diff, /\+Y/);
});
