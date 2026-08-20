import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
    AUTH_SESSION_PATH,
    assertLoginPageHtml,
    buildMcpSmokeArgs,
    buildMcpSmokeRequests,
    buildSmokeScenarios,
    expectAuthFailure,
    extractLocalAssetPaths,
    isExpectedServerReadyOutput,
    isExpectedAuthFailure,
    MCP_ADMIN_ENABLED_PATH,
    MCP_ADMIN_ROTATE_TOKEN_PATH,
    MCP_SMOKE_EXPECTED_TOOL_COUNT,
    MCP_SMOKE_TOOL_NAME
} from './smoke-cli-npx.mjs';

test('buildSmokeScenarios returns insecure, missing-auth, and password-auth scenarios', () => {
    const scenarios = buildSmokeScenarios('/tmp/ocean-brain.tgz');

    assert.deepEqual(
        scenarios.map(({ name }) => name),
        ['insecure-no-auth', 'missing-auth', 'password-auth']
    );
});

test('missing-auth scenario does not provide auth configuration', () => {
    const scenario = buildSmokeScenarios('/tmp/ocean-brain.tgz')
        .find(({ name }) => name === 'missing-auth');

    assert.equal(scenario.args.includes('--allow-insecure-no-auth'), false);
    assert.equal(scenario.env.OCEAN_BRAIN_PASSWORD, undefined);
    assert.equal(scenario.env.OCEAN_BRAIN_SESSION_SECRET, undefined);
});

test('password-auth scenario provides both required env values', () => {
    const scenario = buildSmokeScenarios('/tmp/ocean-brain.tgz')
        .find(({ name }) => name === 'password-auth');

    assert.equal(typeof scenario.env.OCEAN_BRAIN_PASSWORD, 'string');
    assert.equal(typeof scenario.env.OCEAN_BRAIN_SESSION_SECRET, 'string');
    assert.equal(scenario.expectation, 'password-auth');
});

test('insecure-no-auth scenario includes the explicit CLI flag', () => {
    const scenario = buildSmokeScenarios('/tmp/ocean-brain.tgz')
        .find(({ name }) => name === 'insecure-no-auth');

    assert.equal(scenario.args.includes('--allow-insecure-no-auth'), true);
    assert.equal(scenario.expectation, 'graphql-open');
});

test('missing-auth scenario expects startup failure guidance', () => {
    const scenario = buildSmokeScenarios('/tmp/ocean-brain.tgz')
        .find(({ name }) => name === 'missing-auth');

    assert.equal(scenario.expectation, 'startup-auth-failure');
});

test('packaged MCP smoke initializes stdio, lists the full contract, and calls a read tool', () => {
    const requests = buildMcpSmokeRequests();

    assert.equal(requests.initialize.method, 'initialize');
    assert.equal(requests.initialized.method, 'notifications/initialized');
    assert.equal(requests.listTools.method, 'tools/list');
    assert.equal(requests.callTool.method, 'tools/call');
    assert.equal(requests.callTool.params.name, MCP_SMOKE_TOOL_NAME);
    assert.equal(MCP_SMOKE_EXPECTED_TOOL_COUNT, 16);
});

test('packaged MCP smoke passes the rotated token to the bundled adapter', () => {
    const args = buildMcpSmokeArgs('rotated-smoke-token');

    assert.deepEqual(args.slice(-4), [
        '--server',
        'http://127.0.0.1:6683',
        '--token',
        'rotated-smoke-token'
    ]);
    assert.equal(MCP_ADMIN_ENABLED_PATH, '/api/mcp-admin/enabled');
    assert.equal(MCP_ADMIN_ROTATE_TOKEN_PATH, '/api/mcp-admin/token/rotate');
});

test('isExpectedAuthFailure matches the documented startup failure message', () => {
    assert.equal(
        isExpectedAuthFailure(
            'Unable to resolve auth mode. Set OCEAN_BRAIN_PASSWORD and OCEAN_BRAIN_SESSION_SECRET for password mode, or set OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true for disabled mode.'
        ),
        true
    );
});

test('smoke checks auth session status through the mounted API router path', () => {
    assert.equal(AUTH_SESSION_PATH, '/api/auth/session');
});

test('smoke accepts readiness only from the process listening on its configured address', () => {
    assert.equal(isExpectedServerReadyOutput('http server listen on 127.0.0.1:6683 (auth: open)'), true);
    assert.equal(isExpectedServerReadyOutput('Server listening at http://127.0.0.1:6683'), false);
});

test('extractLocalAssetPaths returns only local Vite assets from the client shell', () => {
    assert.deepEqual(
        extractLocalAssetPaths(`
            <link rel="stylesheet" href="/assets/index.css">
            <script type="module" src="/assets/index.js"></script>
            <img src="https://example.com/remote.png">
            <link href="/favicon.ico">
        `),
        ['/assets/index.css', '/assets/index.js']
    );
});


test('assertLoginPageHtml accepts the minimal password login shell', () => {
    assert.doesNotThrow(() => assertLoginPageHtml(`
        <main>
            <div class="brand"><img src="/icon.png" alt="" aria-hidden="true" />Ocean Brain</div>
            <h1 class="sr-only">Sign in</h1>
            <form method="post" action="/login">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" />
                <button type="submit">Sign in</button>
            </form>
        </main>
    `));
});

test('expectAuthFailure reads the latest stderr through the provided getter', async () => {
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;

    const pending = expectAuthFailure(
        child,
        () => 'Unable to resolve auth mode. Set OCEAN_BRAIN_PASSWORD and OCEAN_BRAIN_SESSION_SECRET for password mode, or set OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true for disabled mode.'
    );

    child.exitCode = 1;
    child.emit('exit', 1);

    await assert.doesNotReject(pending);
});
