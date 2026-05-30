import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildMarkdownAppendPlan,
    buildMarkdownPatchPlan,
    buildMarkdownReplacePlan,
    previewMarkdownPatch,
} from './markdown-patch.js';

const note = {
    id: '1427',
    title: 'Patch 기준',
    updatedAt: '2026-05-28T00:00:00.000Z',
};

test('markdown patch preview returns a dry-run diff when exact text is unique', () => {
    const result = previewMarkdownPatch({
        note: {
            ...note,
            markdown: '목표\n\n기존 문장입니다.\n\n완료',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: '특정 문장 하나만 교체',
        selector: {
            type: 'exact_text',
            text: '기존 문장입니다.',
        },
        operation: {
            type: 'replace',
            replacement: '새 문장입니다.',
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
    assert.equal(result.proposed.changedCharCount, '기존 문장입니다.'.length + '새 문장입니다.'.length);
    assert.equal(result.proposed.beforeMarkdownSha256.length, 64);
    assert.equal(result.proposed.afterMarkdownSha256.length, 64);
    assert.match(result.proposed.diff, /-기존 문장입니다\./);
    assert.match(result.proposed.diff, /\+새 문장입니다\./);
    assert.deepEqual(result.warnings, []);
});

test('markdown patch preview fails when exact text is missing', () => {
    const result = previewMarkdownPatch({
        note: {
            ...note,
            markdown: '목표\n\n다른 문장입니다.',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: '없는 문장 교체 시도',
        selector: {
            type: 'exact_text',
            text: '기존 문장입니다.',
        },
        operation: {
            type: 'replace',
            replacement: '새 문장입니다.',
        },
    });

    assert.deepEqual(result, {
        status: 'failed',
        reason: 'TARGET_NOT_FOUND',
        message: 'No exact text match was found in the current note.',
    });
});

test('markdown patch preview requires disambiguation when exact text appears more than once', () => {
    const result = previewMarkdownPatch({
        note: {
            ...note,
            markdown: '회고\n\n중간 내용\n\n회고',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: '마지막 줄의 회고만 교체',
        selector: {
            type: 'exact_text',
            text: '회고',
        },
        operation: {
            type: 'replace',
            replacement: '정리',
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
                text: '회고',
                positionHint: 'first',
            },
            {
                matchIndex: 1,
                lineStart: 5,
                lineEnd: 5,
                text: '회고',
                positionHint: 'last',
            },
        ],
    );
    assert.equal(result.matches[0]?.matchSha256.length, 64);
    assert.equal(result.matches[1]?.matchSha256.length, 64);
    assert.equal(result.matches[0]?.surroundingHash.length, 64);
    assert.equal(result.matches[1]?.surroundingHash.length, 64);
    assert.notEqual(result.matches[0]?.surroundingHash, result.matches[1]?.surroundingHash);
    assert.equal(result.matches[0]?.afterExcerpt, '중간 내용\n\n회고');
    assert.equal(result.matches[1]?.beforeExcerpt, '회고\n\n중간 내용');
});

test('markdown patch plan replaces a selected duplicate match candidate only', () => {
    const firstPreview = previewMarkdownPatch({
        note: {
            ...note,
            markdown: '회고\n\n중간 내용\n\n회고',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: '마지막 줄의 회고만 교체',
        selector: {
            type: 'exact_text',
            text: '회고',
        },
        operation: {
            type: 'replace',
            replacement: '정리',
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
            markdown: '회고\n\n중간 내용\n\n회고',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: '마지막 줄의 회고만 교체',
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
            replacement: '정리',
        },
    });

    assert.equal(result.status, 'dry_run');

    if (result.status !== 'dry_run') {
        throw new Error('expected dry_run result');
    }

    assert.equal(result.afterMarkdown, '회고\n\n중간 내용\n\n정리');
});

test('markdown patch plan fails when match candidate context changed', () => {
    const result = buildMarkdownPatchPlan({
        note: {
            ...note,
            markdown: '회고\n\n바뀐 내용\n\n회고',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: '마지막 줄의 회고만 교체',
        selector: {
            type: 'match_candidate',
            text: '회고',
            matchIndex: 1,
            lineStart: 5,
            matchSha256: 'bad',
            surroundingHash: 'bad',
            positionHint: 'last',
        },
        operation: {
            type: 'replace',
            replacement: '정리',
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
            markdown: '기존 본문',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: '끝에 로그 추가',
        insertion: '- 새 로그 [@MCP]',
        placement: { type: 'end' },
    });

    assert.equal(result.status, 'dry_run');

    if (result.status !== 'dry_run') {
        throw new Error('expected dry_run result');
    }

    assert.equal(result.afterMarkdown, '기존 본문\n\n- 새 로그 [@MCP]');
});

test('markdown append plan fails when the heading is ambiguous', () => {
    const result = buildMarkdownAppendPlan({
        note: {
            ...note,
            markdown: '## 테스트 기준\n\nA\n\n## 테스트 기준\n\nB',
        },
        expectedUpdatedAt: note.updatedAt,
        intent: '테스트 기준에 항목 추가',
        insertion: '- 새 케이스',
        placement: {
            type: 'after_heading',
            heading: '테스트 기준',
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
        intent: '문서 전체 구조 변경',
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
