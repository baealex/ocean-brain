import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    MCP_METADATA_PROPERTY_PATCH_LIMIT,
    createIntentWriteOperationFingerprint,
    metadataPropertyPatchSchema
} from '../src/mcp-intent-write-tools.js';

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

describe('createIntentWriteOperationFingerprint', () => {
    test('binds fingerprints to the server URL and bearer token', () => {
        // Arrange
        const base = createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-a',
            'ocean_brain_patch_note_markdown',
            payload
        );

        // Act
        const differentServerUrl = createIntentWriteOperationFingerprint(
            'http://localhost:6684',
            'token-a',
            'ocean_brain_patch_note_markdown',
            payload
        );
        const differentToken = createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-b',
            'ocean_brain_patch_note_markdown',
            payload
        );

        // Assert
        assert.notEqual(differentServerUrl, base);
        assert.notEqual(differentToken, base);
    });
});

describe('metadataPropertyPatchSchema', () => {
    test('accepts concise set and delete patches', () => {
        // Arrange
        const patch = {
            set: [{ key: 'state', value: 'todo' }],
            deleteKeys: ['project']
        };

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, true);
    });

    test('rejects empty patches', () => {
        // Arrange
        const patch = {};

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, false);
    });

    test('rejects duplicate normalized set keys', () => {
        // Arrange
        const patch = {
            set: [
                { key: 'state', value: 'todo' },
                { key: ' State ', value: 'doing' }
            ]
        };

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, false);
    });

    test('rejects duplicate normalized delete keys', () => {
        // Arrange
        const patch = {
            deleteKeys: ['state', ' State ']
        };

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, false);
    });

    test('rejects setting and deleting the same key', () => {
        // Arrange
        const patch = {
            set: [{ key: 'state', value: 'todo' }],
            deleteKeys: ['state']
        };

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, false);
    });

    test('rejects more than 50 set or delete entries', () => {
        // Arrange
        const overLimit = MCP_METADATA_PROPERTY_PATCH_LIMIT + 1;
        const setPatch = {
            set: Array.from({ length: overLimit }, (_, index) => ({
                key: `field-${index}`,
                value: 'value'
            }))
        };
        const deletePatch = {
            deleteKeys: Array.from({ length: overLimit }, (_, index) => `field-${index}`)
        };

        // Act
        const setResult = metadataPropertyPatchSchema.safeParse(setPatch);
        const deleteResult = metadataPropertyPatchSchema.safeParse(deletePatch);

        // Assert
        assert.equal(setResult.success, false);
        assert.equal(deleteResult.success, false);
    });
});
