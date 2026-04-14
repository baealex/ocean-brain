import test from 'node:test';
import assert from 'node:assert/strict';

import {
    InvalidTagNameError,
    createTagOrganizationService,
    normalizeTagName
} from '../src/modules/tag-organization.js';

test('normalizeTagName trims input and prefixes Ocean Brain tags with @', () => {
    assert.equal(normalizeTagName('project'), '@project');
    assert.equal(normalizeTagName('  @project  '), '@project');
});

test('normalizeTagName rejects empty or multi-token tag names', () => {
    assert.throws(() => normalizeTagName('   '), InvalidTagNameError);
    assert.throws(() => normalizeTagName('project alpha'), InvalidTagNameError);
});

test('tag organization service returns an existing tag without creating a duplicate', async () => {
    let createCalls = 0;
    const service = createTagOrganizationService({
        createTag: async () => {
            createCalls += 1;
            throw new Error('should not create');
        },
        findTagByName: async () => ({
            id: 3,
            name: '@project',
            createdAt: new Date('2026-03-30T00:00:00.000Z'),
            updatedAt: new Date('2026-03-30T00:00:00.000Z')
        })
    });

    const result = await service.ensureTag('project');

    assert.equal(createCalls, 0);
    assert.deepEqual(result, {
        created: false,
        normalizedName: '@project',
        tag: {
            id: '3',
            name: '@project',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
        }
    });
});

test('tag organization service creates a tag when the normalized name is missing', async () => {
    const service = createTagOrganizationService({
        createTag: async (name) => ({
            id: 5,
            name,
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
            updatedAt: new Date('2026-03-31T00:00:00.000Z')
        }),
        findTagByName: async () => null
    });

    const result = await service.ensureTag('@inbox');

    assert.deepEqual(result, {
        created: true,
        normalizedName: '@inbox',
        tag: {
            id: '5',
            name: '@inbox',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z'
        }
    });
});

test('tag organization service returns the canonical tag after a unique conflict race', async () => {
    let findCalls = 0;
    const service = createTagOrganizationService({
        createTag: async () => {
            throw {
                code: 'P2002',
                meta: {
                    target: ['name']
                }
            };
        },
        findTagByName: async () => {
            findCalls += 1;

            if (findCalls === 1) {
                return null;
            }

            return {
                id: 7,
                name: '@project',
                createdAt: new Date('2026-04-13T00:00:00.000Z'),
                updatedAt: new Date('2026-04-13T00:00:00.000Z')
            };
        }
    });

    const result = await service.ensureTag('project');

    assert.equal(findCalls, 2);
    assert.deepEqual(result, {
        created: false,
        normalizedName: '@project',
        tag: {
            id: '7',
            name: '@project',
            createdAt: '2026-04-13T00:00:00.000Z',
            updatedAt: '2026-04-13T00:00:00.000Z'
        }
    });
});
