import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeRedirectPath } from './service.js';

test('sanitizeRedirectPath keeps local app routes', () => {
    assert.equal(sanitizeRedirectPath('/notes/123?tab=edit#title'), '/notes/123?tab=edit#title');
});

test('sanitizeRedirectPath keeps localhost absolute urls for local auth redirects', () => {
    assert.equal(
        sanitizeRedirectPath('http://127.0.0.1:5173/notes/123?tab=edit#title'),
        'http://127.0.0.1:5173/notes/123?tab=edit#title',
    );
});

test('sanitizeRedirectPath blocks login routes and foreign hosts', () => {
    assert.equal(sanitizeRedirectPath('/login?next=%2Fnotes'), '/');
    assert.equal(sanitizeRedirectPath('https://example.com/notes/123'), '/');
});
