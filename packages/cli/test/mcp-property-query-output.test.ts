import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatPropertyQueryResponse } from '../src/mcp-property-query-output.js';

const createPropertyQueryFixture = () => ({
    query: {
        propertyFilters: [{ key: 'state', valueType: 'select', operator: 'equals', value: 'todo' }],
        tagNames: [],
        mode: 'and',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        limit: 20,
        offset: 0
    },
    result: {
        totalCount: 1,
        notes: [
            {
                id: '7',
                title: 'Project note',
                createdAt: '2026-06-01T00:00:00.000Z',
                updatedAt: '2026-06-02T00:00:00.000Z',
                tags: [{ id: '1', name: '@project' }],
                properties: [
                    { key: 'state', name: 'State', value: 'todo', valueType: 'select' },
                    { key: 'project', name: 'Project', value: 'ocean', valueType: 'text' }
                ]
            }
        ]
    }
});

describe('formatPropertyQueryResponse', () => {
    test('omits properties unless requested', () => {
        // Arrange
        const { result, query } = createPropertyQueryFixture();

        // Act
        const output = formatPropertyQueryResponse({
            result,
            query,
            includeProperties: false,
            propertyKeys: []
        });

        // Assert
        assert.deepEqual(output.notes[0], {
            id: '7',
            title: 'Project note',
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-02T00:00:00.000Z',
            tags: ['@project']
        });
    });

    test('includes only requested property keys', () => {
        // Arrange
        const { result, query } = createPropertyQueryFixture();

        // Act
        const output = formatPropertyQueryResponse({
            result,
            query,
            includeProperties: true,
            propertyKeys: ['state']
        });

        // Assert
        assert.deepEqual(output.notes[0]?.properties, [
            { key: 'state', name: 'State', value: 'todo', valueType: 'select' }
        ]);
    });
});
