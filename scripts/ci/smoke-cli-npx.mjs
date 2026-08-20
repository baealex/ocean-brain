#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { createServer } from 'net';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const [, , packageArg] = process.argv;

function resolveNpxPackageSpec(spec) {
    const looksLikePath = spec.endsWith('.tgz')
        || spec.startsWith('.')
        || spec.startsWith('/')
        || /^[A-Za-z]:[\\/]/.test(spec);

    return looksLikePath ? path.resolve(spec) : spec;
}

const packageSpec = packageArg ? resolveNpxPackageSpec(packageArg) : null;
const host = '127.0.0.1';
const configuredPort = process.env.CLI_SMOKE_PORT;
let port = Number(configuredPort ?? '6683');
let rootUrl = `http://${host}:${port}`;
export const AUTH_SESSION_PATH = '/api/auth/session';
export const MCP_ADMIN_ENABLED_PATH = '/api/mcp-admin/enabled';
export const MCP_ADMIN_ROTATE_TOKEN_PATH = '/api/mcp-admin/token/rotate';
const isWindows = process.platform === 'win32';
const readyTimeoutMs = Number(
    process.env.CLI_SMOKE_READY_TIMEOUT_MS ?? (isWindows ? '300000' : '120000')
);
const MCP_PROTOCOL_VERSION = '2025-11-25';
export const MCP_SMOKE_TOOL_NAME = 'ocean_brain_list_tags';
export const MCP_SMOKE_EXPECTED_TOOL_COUNT = 16;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const isExpectedServerReadyOutput = (stdout) =>
    stdout.includes(`http server listen on ${host}:${port}`);

const assignEphemeralSmokePort = () => new Promise((resolve, reject) => {
    const probe = createServer();

    probe.once('error', reject);
    probe.listen(0, host, () => {
        const address = probe.address();
        if (!address || typeof address === 'string') {
            probe.close();
            reject(new Error('Failed to allocate an ephemeral CLI smoke port.'));
            return;
        }

        const ephemeralPort = address.port;
        probe.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            port = ephemeralPort;
            rootUrl = `http://${host}:${port}`;
            resolve();
        });
    });
});

const getSetCookies = (headers) => {
    if (typeof headers.getSetCookie === 'function') {
        return headers.getSetCookie();
    }

    const setCookie = headers.get('set-cookie');
    return setCookie ? [setCookie] : [];
};

const toCookieHeader = (setCookies) => setCookies.map(cookie => cookie.split(';')[0]).join('; ');

const extractCsrfToken = (cookie) => {
    const token = cookie
        ?.split(';')
        .map(part => part.trim())
        .find(part => part.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    return token ? decodeURIComponent(token) : undefined;
};

export function extractLocalAssetPaths(html) {
    return [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)]
        .map(match => match[1])
        .filter(assetPath => assetPath.startsWith('/assets/'));
}

export function buildSmokeScenarios(resolvedPackageSpec) {
    const baseArgs = [
        '--yes',
        '--package',
        resolvedPackageSpec,
        'ocean-brain',
        'serve',
        '--port',
        String(port),
        '--host',
        host
    ];

    return [
        {
            name: 'insecure-no-auth',
            args: [...baseArgs, '--allow-insecure-no-auth'],
            env: {},
            expectation: 'graphql-open'
        },
        {
            name: 'missing-auth',
            args: baseArgs,
            env: {},
            expectation: 'startup-auth-failure'
        },
        {
            name: 'password-auth',
            args: baseArgs,
            env: {
                OCEAN_BRAIN_PASSWORD: 'smoke-password',
                OCEAN_BRAIN_SESSION_SECRET: 'smoke-session-secret-for-cli-tests'
            },
            expectation: 'password-auth'
        }
    ];
}

export function buildMcpSmokeArgs(token) {
    return [
        '--yes',
        '--package',
        packageSpec,
        'ocean-brain',
        'mcp',
        '--server',
        rootUrl,
        '--token',
        token
    ];
}

export function buildMcpSmokeRequests() {
    return {
        initialize: {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: MCP_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: {
                    name: 'ocean-brain-packaged-smoke',
                    version: '0.0.0'
                }
            }
        },
        initialized: {
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            params: {}
        },
        listTools: {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
        },
        callTool: {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: MCP_SMOKE_TOOL_NAME,
                arguments: {}
            }
        }
    };
}

export function isExpectedAuthFailure(stderr) {
    return stderr.includes('Unable to resolve auth mode.')
        && stderr.includes('OCEAN_BRAIN_PASSWORD')
        && stderr.includes('OCEAN_BRAIN_SESSION_SECRET')
        && stderr.includes('OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true');
}

function spawnScenarioProcess(scenario, dataDir, imageDir) {
    const child = spawn(
        isWindows ? 'cmd.exe' : 'npx',
        isWindows
            ? ['/d', '/s', '/c', 'npx', ...scenario.args]
            : scenario.args,
        {
            detached: !isWindows,
            env: {
                ...process.env,
                ...scenario.env,
                OCEAN_BRAIN_DATA_DIR: dataDir,
                OCEAN_BRAIN_IMAGE_DIR: imageDir
            },
            stdio: ['ignore', 'pipe', 'pipe']
        }
    );

    let stdoutBuffer = '';
    let stderrBuffer = '';
    child.stdout.on('data', chunk => {
        const text = chunk.toString();
        stdoutBuffer += text;
        process.stdout.write(text);
    });
    child.stderr.on('data', chunk => {
        const text = chunk.toString();
        stderrBuffer += text;
        process.stderr.write(text);
    });

    return {
        child,
        getStdout: () => stdoutBuffer,
        getStderr: () => stderrBuffer
    };
}

function spawnMcpProcess(token) {
    const args = buildMcpSmokeArgs(token);
    const child = spawn(
        isWindows ? 'cmd.exe' : 'npx',
        isWindows ? ['/d', '/s', '/c', 'npx', ...args] : args,
        {
            detached: !isWindows,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        }
    );
    let stderrBuffer = '';
    child.stderr.on('data', chunk => {
        const text = chunk.toString();
        stderrBuffer += text;
        process.stderr.write(text);
    });

    return {
        child,
        getStderr: () => stderrBuffer
    };
}

function createJsonRpcStdioClient(child, getStderr) {
    let stdoutBuffer = '';
    const pending = new Map();

    const failPending = (error) => {
        for (const { reject, timeout } of pending.values()) {
            clearTimeout(timeout);
            reject(error);
        }
        pending.clear();
    };

    child.stdout.on('data', chunk => {
        stdoutBuffer += chunk.toString();

        while (stdoutBuffer.includes('\n')) {
            const separator = stdoutBuffer.indexOf('\n');
            const line = stdoutBuffer.slice(0, separator).replace(/\r$/, '');
            stdoutBuffer = stdoutBuffer.slice(separator + 1);

            if (!line.trim()) continue;

            let message;
            try {
                message = JSON.parse(line);
            } catch (error) {
                failPending(new Error(`Packaged MCP emitted invalid JSON-RPC: ${line}`, { cause: error }));
                continue;
            }

            const waiter = pending.get(message.id);
            if (!waiter) continue;

            pending.delete(message.id);
            clearTimeout(waiter.timeout);

            if (message.error) {
                waiter.reject(new Error(`Packaged MCP request failed: ${JSON.stringify(message.error)}`));
                continue;
            }

            waiter.resolve(message.result);
        }
    });

    child.once('exit', (code, signal) => {
        if (pending.size === 0) return;

        failPending(new Error(
            `Packaged MCP exited before responding (code=${code}, signal=${signal}).\n${getStderr()}`
        ));
    });

    const send = (message) => {
        child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    const request = (message, timeoutMs) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pending.delete(message.id);
            reject(new Error(`Packaged MCP timed out handling ${message.method}.\n${getStderr()}`));
        }, timeoutMs);

        pending.set(message.id, { reject, resolve, timeout });
        send(message);
    });

    return { request, send };
}

async function assertPackagedMcpContract(token) {
    const { child, getStderr } = spawnMcpProcess(token);
    const client = createJsonRpcStdioClient(child, getStderr);
    const requests = buildMcpSmokeRequests();

    try {
        const initialization = await client.request(requests.initialize, readyTimeoutMs);
        if (!initialization?.protocolVersion || !initialization?.serverInfo?.name) {
            throw new Error(`Packaged MCP returned an invalid initialize result: ${JSON.stringify(initialization)}`);
        }

        client.send(requests.initialized);
        const listed = await client.request(requests.listTools, 30_000);
        const toolNames = listed?.tools?.map(tool => tool.name) ?? [];

        if (toolNames.length !== MCP_SMOKE_EXPECTED_TOOL_COUNT || !toolNames.includes(MCP_SMOKE_TOOL_NAME)) {
            throw new Error(`Packaged MCP returned an unexpected tool list: ${JSON.stringify(toolNames)}`);
        }

        const called = await client.request(requests.callTool, 30_000);
        if (called?.isError || !Array.isArray(called?.content) || called.content.length === 0) {
            throw new Error(`Packaged MCP tool call failed: ${JSON.stringify(called)}`);
        }

        console.log(`Packaged MCP smoke passed: ${toolNames.length} tools and ${MCP_SMOKE_TOOL_NAME} call`);
    } catch (error) {
        const stderrBuffer = getStderr();
        if (stderrBuffer.trim()) {
            console.error(`\n--- packaged MCP stderr ---\n${stderrBuffer}\n--- end packaged MCP stderr ---\n`);
        }
        throw error;
    } finally {
        child.stdin.end();
        await stopProcess(child);
    }
}

async function postMcpAdmin(pathname, body) {
    const response = await fetch(`${rootUrl}${pathname}`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const payload = await response.json();

    if (response.status !== 200) {
        throw new Error(`${pathname} returned HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }

    return payload;
}

async function configureMcpForSmoke() {
    const enabled = await postMcpAdmin(MCP_ADMIN_ENABLED_PATH, { enabled: true });
    if (enabled.enabled !== true) {
        throw new Error(`${MCP_ADMIN_ENABLED_PATH} did not enable MCP: ${JSON.stringify(enabled)}`);
    }

    const rotated = await postMcpAdmin(MCP_ADMIN_ROTATE_TOKEN_PATH, {});
    if (typeof rotated.token !== 'string' || rotated.token.length === 0) {
        throw new Error(`${MCP_ADMIN_ROTATE_TOKEN_PATH} returned an invalid token`);
    }

    return rotated.token;
}

async function waitForReady(child, getStdout, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`CLI process exited early (code=${child.exitCode}, signal=${child.signalCode})`);
        }

        if (isExpectedServerReadyOutput(getStdout())) {
            try {
                const response = await fetch(`${rootUrl}/`, {
                    signal: AbortSignal.timeout(3000)
                });
                if (response.status === 200) return;
            } catch {
                // The spawned server logged readiness but is not accepting requests yet.
            }
        }

        await sleep(1000);
    }

    throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

async function assertGraphql() {
    const response = await fetch(`${rootUrl}/graphql`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: '{ allImages(pagination: {limit: 1, offset: 0}) { totalCount } }'
        })
    });

    if (response.status !== 200) {
        throw new Error(`/graphql returned HTTP ${response.status}`);
    }

    const bodyText = await response.text();
    if (bodyText.includes('"errors"')) {
        throw new Error(`GraphQL returned errors: ${bodyText}`);
    }
}

async function assertNoteRoundTrip() {
    const content = JSON.stringify([
        {
            id: 'bundle-smoke-paragraph',
            type: 'paragraph',
            props: {
                backgroundColor: 'default',
                textColor: 'default',
                textAlignment: 'left'
            },
            content: [
                {
                    type: 'text',
                    text: 'Bundled BlockNote round trip',
                    styles: {}
                }
            ],
            children: []
        }
    ]);
    const response = await fetch(`${rootUrl}/graphql`, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `
                mutation BundleSmoke($note: NoteInput!) {
                    createNote(note: $note) {
                        id
                        title
                        contentAsMarkdown
                    }
                }
            `,
            variables: {
                note: {
                    title: 'Bundle smoke note',
                    content
                }
            }
        })
    });

    const payload = await response.json();
    if (response.status !== 200) {
        throw new Error(`Bundled note round trip returned HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }

    if (payload.errors) {
        throw new Error(`Bundled note round trip returned errors: ${JSON.stringify(payload.errors)}`);
    }

    const note = payload.data?.createNote;
    if (note?.title !== 'Bundle smoke note' || !note.contentAsMarkdown?.includes('Bundled BlockNote round trip')) {
        throw new Error(`Bundled note round trip returned an unexpected payload: ${JSON.stringify(payload)}`);
    }
}

async function assertClientShellLoads(pathname) {
    const response = await fetch(`${rootUrl}${pathname}`, {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000)
    });

    if (response.status !== 200) {
        throw new Error(`${pathname} returned HTTP ${response.status} instead of 200`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
        throw new Error(`${pathname} returned unexpected content-type: ${contentType}`);
    }

    const html = await response.text();
    if (!html.includes('id="root"')) {
        throw new Error(`${pathname} did not return the SPA root element`);
    }

    const assetPaths = extractLocalAssetPaths(html);
    if (assetPaths.length === 0) {
        throw new Error(`${pathname} did not include any local client assets`);
    }

    for (const assetPath of assetPaths) {
        const assetResponse = await fetch(`${rootUrl}${assetPath}`, {
            signal: AbortSignal.timeout(5000)
        });

        if (assetResponse.status !== 200) {
            throw new Error(`${assetPath} returned HTTP ${assetResponse.status}`);
        }

        const assetBody = await assetResponse.text();
        if (assetBody.length === 0) {
            throw new Error(`${assetPath} returned an empty response`);
        }
    }
}

async function assertProtectedHomeRedirectsToLogin() {
    const response = await fetch(`${rootUrl}/`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000)
    });

    if (response.status !== 303) {
        throw new Error(`/ returned HTTP ${response.status} instead of 303 in password mode`);
    }

    const location = response.headers.get('location');
    if (location !== '/login?next=%2F') {
        throw new Error(`/ redirected to unexpected location in password mode: ${location}`);
    }
}

export function assertLoginPageHtml(html) {
    const expectedFragments = [
        'Ocean Brain',
        '<form method="post" action="/login">',
        'name="password"',
        'type="password"',
        'Sign in'
    ];

    for (const expectedText of expectedFragments) {
        if (!html.includes(expectedText)) {
            throw new Error(`/login response missing expected content: ${expectedText}`);
        }
    }
}

async function assertLoginPageLoads() {
    const response = await fetch(`${rootUrl}/login?next=%2F`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000)
    });

    if (response.status !== 200) {
        throw new Error(`/login returned HTTP ${response.status} instead of 200`);
    }

    assertLoginPageHtml(await response.text());
}

async function assertAuthSession(expected) {
    const response = await fetch(`${rootUrl}${AUTH_SESSION_PATH}`, {
        signal: AbortSignal.timeout(5000)
    });

    if (response.status !== 200) {
        throw new Error(`${AUTH_SESSION_PATH} returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    for (const [key, value] of Object.entries(expected)) {
        if (payload[key] !== value) {
            throw new Error(`${AUTH_SESSION_PATH} returned unexpected ${key}: ${payload[key]}`);
        }
    }
}

async function assertGraphqlUnauthorized() {
    const sessionResponse = await fetch(`${rootUrl}${AUTH_SESSION_PATH}`, {
        signal: AbortSignal.timeout(5000)
    });
    const cookie = toCookieHeader(getSetCookies(sessionResponse.headers));
    const csrfToken = extractCsrfToken(cookie);
    const response = await fetch(`${rootUrl}/graphql`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
            ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {})
        },
        body: JSON.stringify({
            query: '{ allImages(pagination: {limit: 1, offset: 0}) { totalCount } }'
        })
    });

    if (response.status !== 401) {
        throw new Error(`/graphql returned HTTP ${response.status} instead of 401`);
    }

    const bodyText = await response.text();
    if (!bodyText.includes('Authentication required')) {
        throw new Error(`GraphQL unauthorized response missing expected message: ${bodyText}`);
    }
}

async function stopProcess(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;

    if (process.platform === 'win32') {
        // Ensure cmd/npx/server child tree is terminated on Windows.
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore'
        });
    } else {
        try {
            // Kill the full process group started by npx so child server does not hang the job.
            process.kill(-child.pid, 'SIGTERM');
        } catch {
            child.kill('SIGTERM');
        }
    }

    await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        sleep(10000)
    ]);

    if (child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') {
            spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
                stdio: 'ignore'
            });
        } else {
            try {
                process.kill(-child.pid, 'SIGKILL');
            } catch {
                child.kill('SIGKILL');
            }
        }
    }
}

export async function expectAuthFailure(child, getStderr, timeoutMs = 15000) {
    if (child.exitCode === null && child.signalCode === null) {
        let timeout;

        try {
            await Promise.race([
                new Promise(resolve => child.once('exit', resolve)),
                new Promise(resolve => {
                    timeout = setTimeout(resolve, timeoutMs);
                })
            ]);
        } finally {
            clearTimeout(timeout);
        }
    }

    if (child.exitCode === null && child.signalCode === null) {
        throw new Error(`CLI process did not fail within ${timeoutMs}ms for missing-auth scenario`);
    }

    const stderrBuffer = getStderr();
    if (!isExpectedAuthFailure(stderrBuffer)) {
        throw new Error(`CLI process failed without the expected auth guidance.\n\n${stderrBuffer}`);
    }
}

async function runScenario(scenario) {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-smoke-'));
    const dataDir = path.join(tempRoot, 'data');
    const imageDir = path.join(dataDir, 'assets', 'images');
    mkdirSync(imageDir, { recursive: true });

    const { child, getStdout, getStderr } = spawnScenarioProcess(scenario, dataDir, imageDir);

    try {
        if (scenario.name === 'missing-auth') {
            await expectAuthFailure(child, getStderr, readyTimeoutMs);
            console.log(`CLI smoke scenario passed: ${scenario.name}`);
            return;
        }

        await waitForReady(child, getStdout, readyTimeoutMs);
        if (scenario.expectation === 'graphql-open') {
            await assertClientShellLoads('/');
            await assertClientShellLoads('/12');
            await assertAuthSession({
                mode: 'open',
                authRequired: false,
                authenticated: false
            });
            await assertGraphql();
            await assertNoteRoundTrip();
            const mcpToken = await configureMcpForSmoke();
            await assertPackagedMcpContract(mcpToken);
        }

        if (scenario.expectation === 'password-auth') {
            await assertProtectedHomeRedirectsToLogin();
            await assertLoginPageLoads();
            await assertAuthSession({
                mode: 'password',
                authRequired: true,
                authenticated: false
            });
            await assertGraphqlUnauthorized();
        }
        console.log(`CLI smoke scenario passed: ${scenario.name}`);
    } catch (error) {
        const stderrBuffer = getStderr();
        if (stderrBuffer.length > 0) {
            console.error(`\n--- CLI stderr (${scenario.name}) ---`);
            console.error(stderrBuffer);
            console.error(`--- end stderr (${scenario.name}) ---\n`);
        }
        throw error;
    } finally {
        await stopProcess(child);
        let cleaned = false;
        for (let i = 0; i < 6; i++) {
            try {
                rmSync(tempRoot, { recursive: true, force: true });
                cleaned = true;
                break;
            } catch (error) {
                const code = error?.code;
                if (code !== 'EBUSY' && code !== 'EPERM') throw error;
                await sleep(500);
            }
        }

        if (!cleaned) {
            console.warn(`Warning: failed to clean temp directory: ${tempRoot}`);
        }
    }
}

async function main() {
    if (!packageSpec) {
        console.error('Usage: node scripts/ci/smoke-cli-npx.mjs <path-to-cli-tarball-or-package-spec>');
        process.exit(1);
    }

    try {
        if (!configuredPort) {
            await assignEphemeralSmokePort();
        }
        for (const scenario of buildSmokeScenarios(packageSpec)) {
            await runScenario(scenario);
        }
        console.log('CLI smoke test passed.');
    } catch (error) {
        throw error;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
