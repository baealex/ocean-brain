import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMcpReadNoteOutput } from '../src/mcp-note-output.js';

test('formatMcpReadNoteOutput includes a back reference summary before the markdown body', () => {
    const output = formatMcpReadNoteOutput({
        note: {
            id: '12',
            title: 'Architecture Notes',
            contentAsMarkdown: 'Body line 1\nBody line 2',
            createdAt: '2026-04-07T10:00:00.000Z',
            updatedAt: '2026-04-07T11:00:00.000Z',
            tags: [
                { id: '1', name: '@OceanBrain' },
                { id: '2', name: '@todo' }
            ]
        },
        backReferences: [
            { id: '31', title: 'Sprint Summary' },
            { id: '32', title: 'Reference Hub' }
        ],
        maxLength: 0
    });

    assert.match(output, /Back References:\n- 31: Sprint Summary\n- 32: Reference Hub\n\nBody line 1\nBody line 2$/);
});

test('formatMcpReadNoteOutput truncates markdown and shows an empty back reference state', () => {
    const output = formatMcpReadNoteOutput({
        note: {
            id: '21',
            title: 'Long Note',
            contentAsMarkdown: 'abcdefghij',
            createdAt: '2026-04-07T10:00:00.000Z',
            updatedAt: '2026-04-07T11:00:00.000Z',
            tags: []
        },
        backReferences: [],
        maxLength: 5
    });

    assert.match(output, /Tags: \(none\)/);
    assert.match(output, /Content: 10 chars \(showing first 5\)/);
    assert.match(output, /Back References:\n- \(none\)\n\nabcde\n\n\.\.\. \(truncated, use maxLength: 0 to read full content\)$/);
});
