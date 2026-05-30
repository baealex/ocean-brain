import assert from 'node:assert/strict';
import test from 'node:test';

import { createIntentWriteOperationFingerprint } from '../src/mcp-intent-write-tools.js';

const payload = {
    id: '7',
    intent: 'Replace one sentence',
    selector: {
        type: 'exact_text',
        text: 'Original sentence.'
    },
    operation: {
        type: 'replace',
        replacement: 'Updated sentence.'
    }
};

test('intent write fingerprints are bound to the server URL and bearer token', () => {
    const base = createIntentWriteOperationFingerprint(
        'http://localhost:6683',
        'token-a',
        'ocean_brain_patch_note_markdown',
        payload
    );

    assert.notEqual(
        createIntentWriteOperationFingerprint(
            'http://localhost:6684',
            'token-a',
            'ocean_brain_patch_note_markdown',
            payload
        ),
        base
    );
    assert.notEqual(
        createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-b',
            'ocean_brain_patch_note_markdown',
            payload
        ),
        base
    );
});
