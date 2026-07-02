#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
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
const port = Number(process.env.CLI_SMOKE_PORT ?? '6683');
const rootUrl = `http://${host}:${port}`;
export const AUTH_SESSION_PATH = '/api/auth/session';
const isWindows = process.platform === 'win32';
const readyTimeoutMs = Number(
    process.env.CLI_SMOKE_READY_TIMEOUT_MS ?? (isWindows ? '300000' : '120000')
);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    let stderrBuffer = '';
    child.stdout.on('data', chunk => process.stdout.write(chunk));
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

async function waitForReady(child, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`CLI process exited early (code=${child.exitCode}, signal=${child.signalCode})`);
        }

        try {
            const response = await fetch(`${rootUrl}/`, {
                signal: AbortSignal.timeout(3000)
            });
            if (response.status === 200) return;
        } catch {
            // Server not ready yet.
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

async function assertClientShellLoads(pathname) {
    const response = await fetch(`${rootUrl}${pathname}`, {
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
        await Promise.race([
            new Promise(resolve => child.once('exit', resolve)),
            sleep(timeoutMs)
        ]);
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

    const { child, getStderr } = spawnScenarioProcess(scenario, dataDir, imageDir);

    try {
        if (scenario.name === 'missing-auth') {
            await expectAuthFailure(child, getStderr, readyTimeoutMs);
            console.log(`CLI smoke scenario passed: ${scenario.name}`);
            return;
        }

        await waitForReady(child, readyTimeoutMs);
        if (scenario.expectation === 'graphql-open') {
            await assertClientShellLoads('/');
            await assertAuthSession({
                mode: 'open',
                authRequired: false,
                authenticated: false
            });
            await assertGraphql();
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
