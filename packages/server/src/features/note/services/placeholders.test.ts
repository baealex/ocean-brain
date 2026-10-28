import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaceholderReplacer } from './placeholders.js';

test('built-in dates use creation time even when the authoring service predates the new year', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 27, 12) });
    const replace = createPlaceholderReplacer(async () => []);

    t.mock.timers.setTime(Date.UTC(2027, 0, 15, 12));
    const title = await replace('Journal {%year%}-{%month%} {%unknown%}');

    assert.equal(title, 'Journal 2027-01 {%unknown%}');
});
