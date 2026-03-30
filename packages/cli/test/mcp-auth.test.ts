import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveMcpBearerToken } from '../src/mcp-auth.js';

test('resolveMcpBearerToken prefers token-file over env and direct token', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-mcp-token-'));
    const tokenFile = path.join(tempDir, 'token.txt');

    fs.writeFileSync(tokenFile, 'from-file\n', 'utf-8');

    assert.equal(
        resolveMcpBearerToken(
            {
                tokenFile,
                tokenEnv: 'CUSTOM_TOKEN',
                token: 'from-option'
            },
            {
                CUSTOM_TOKEN: 'from-env'
            }
        ),
        'from-file'
    );
});

test('resolveMcpBearerToken reads the configured token env name', () => {
    assert.equal(
        resolveMcpBearerToken(
            {
                tokenEnv: 'CUSTOM_TOKEN'
            },
            {
                CUSTOM_TOKEN: 'from-env'
            }
        ),
        'from-env'
    );
});

test('resolveMcpBearerToken falls back to the direct token when no file or env token exists', () => {
    assert.equal(
        resolveMcpBearerToken(
            {
                token: 'from-option'
            },
            {}
        ),
        'from-option'
    );
});
