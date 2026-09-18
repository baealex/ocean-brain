import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppGatewayAccessService } from './access.js';

test('app gateway access tokens authorize only the installation that issued them', () => {
    const access = createAppGatewayAccessService();
    const grant = access.issue('search-1');

    assert.equal(access.verify('search-1', grant.token), true);
    assert.equal(access.verify('search-2', grant.token), false);
    assert.equal(access.verify('search-1', 'invalid-token'), false);
});
