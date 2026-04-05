import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveMcpBearerToken } from '../src/mcp-auth.js';

const writeTempToken = (value: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-mcp-token-'));
    const tokenFile = path.join(dir, 'token.txt');
    fs.writeFileSync(tokenFile, `${value}\n`, 'utf-8');
    return tokenFile;
};

test('resolveMcpBearerToken prefers token-file over direct token', () => {
    const tokenFile = writeTempToken('from-file');
    const token = resolveMcpBearerToken({
        tokenFile,
        token: 'from-option'
    });
    assert.equal(token, 'from-file');
});

test('resolveMcpBearerToken falls back to direct token', () => {
    const token = resolveMcpBearerToken({ token: 'from-option' });
    assert.equal(token, 'from-option');
});
