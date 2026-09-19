import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppGatewayAccessService } from './access.js';

test('app gateway access tokens authorize only the connection that issued them', () => {
    const access = createAppGatewayAccessService();
    const grant = access.issue('search-1', 'https');

    assert.equal(access.verify('search-1', grant.token), true);
    assert.equal(access.verify('search-2', grant.token), false);
    assert.equal(access.verify('search-1', 'invalid-token'), false);
    assert.equal(access.resolve('search-1', grant.token)?.publicProtocol, 'https');
});
