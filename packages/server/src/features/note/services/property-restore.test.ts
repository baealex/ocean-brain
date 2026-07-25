import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRestoredPropertyTarget } from './property-restore.js';

test('property restore keeps only values compatible with the current shared schema', async () => {
    const definitions = new Map([
        ['memo', { id: 10, valueType: 'text' as const }],
        ['state', { id: 20, valueType: 'select' as const }],
    ]);
    const options = new Map([['20:doing', { id: 30 }]]);
    const dependencies = {
        findDefinitionByKey: async (key: string) => definitions.get(key) ?? null,
        findOptionByValue: async (definitionId: number, value: string) =>
            options.get(`${definitionId}:${value}`) ?? null,
    };

    assert.deepEqual(
        await resolveRestoredPropertyTarget({ key: 'memo', valueType: 'text', optionValue: null }, dependencies),
        { propertyDefinitionId: 10, optionId: null },
    );
    assert.deepEqual(
        await resolveRestoredPropertyTarget({ key: 'state', valueType: 'select', optionValue: 'doing' }, dependencies),
        { propertyDefinitionId: 20, optionId: 30 },
    );
    assert.equal(
        await resolveRestoredPropertyTarget({ key: 'removed', valueType: 'text', optionValue: null }, dependencies),
        null,
    );
    assert.equal(
        await resolveRestoredPropertyTarget({ key: 'memo', valueType: 'number', optionValue: null }, dependencies),
        null,
    );
    assert.equal(
        await resolveRestoredPropertyTarget(
            { key: 'state', valueType: 'select', optionValue: 'removed-option' },
            dependencies,
        ),
        null,
    );
});
