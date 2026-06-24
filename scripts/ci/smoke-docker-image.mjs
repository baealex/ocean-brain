#!/usr/bin/env node

import { spawnSync } from 'child_process';

const [, , image] = process.argv;
const host = '127.0.0.1';
const hostPort = Number(process.env.DOCKER_SMOKE_PORT ?? '6686');
const rootUrl = `http://${host}:${hostPort}`;
const containerName = `ocean-brain-smoke-${process.pid}-${Date.now()}`;
const retryAttempts = Number(process.env.DOCKER_SMOKE_PULL_ATTEMPTS ?? '20');
const retryDelayMs = Number(process.env.DOCKER_SMOKE_PULL_DELAY_MS ?? '15000');
const readyTimeoutMs = Number(process.env.DOCKER_SMOKE_READY_TIMEOUT_MS ?? '120000');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        stdio: options.stdio ?? 'inherit',
        env: process.env
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
    }

    return result;
}

async function pullWithRetry() {
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        const result = spawnSync('docker', ['pull', image], {
            encoding: 'utf8',
            stdio: 'inherit',
            env: process.env
        });

        if (result.status === 0) return;
        if (attempt === retryAttempts) {
            throw new Error(`docker pull failed after ${retryAttempts} attempts: ${image}`);
        }

        console.log(`docker pull did not succeed yet (${attempt}/${retryAttempts}); retrying in ${retryDelayMs}ms...`);
        await sleep(retryDelayMs);
    }
}

async function waitForReady() {
    const deadline = Date.now() + readyTimeoutMs;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${rootUrl}/api/auth/session`, {
                signal: AbortSignal.timeout(3000)
            });
            if (response.status === 200) return;
        } catch {
            // Container is not ready yet.
        }

        await sleep(1000);
    }

    throw new Error(`Docker image did not become ready within ${readyTimeoutMs}ms`);
}

async function assertOpenMode() {
    const sessionResponse = await fetch(`${rootUrl}/api/auth/session`, {
        signal: AbortSignal.timeout(5000)
    });
    if (sessionResponse.status !== 200) {
        throw new Error(`/api/auth/session returned HTTP ${sessionResponse.status}`);
    }

    const session = await sessionResponse.json();
    if (session.mode !== 'open' || session.authRequired !== false) {
        throw new Error(`/api/auth/session returned unexpected payload: ${JSON.stringify(session)}`);
    }
}

async function assertClientShell() {
    const response = await fetch(`${rootUrl}/`, {
        signal: AbortSignal.timeout(5000)
    });
    if (response.status !== 200) {
        throw new Error(`/ returned HTTP ${response.status}`);
    }

    const html = await response.text();
    if (!html.includes('id="root"')) {
        throw new Error('/ did not return the SPA root element');
    }
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

function cleanup() {
    spawnSync('docker', ['logs', containerName], { stdio: 'inherit' });
    spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
}

async function main() {
    if (!image) {
        console.error('Usage: node scripts/ci/smoke-docker-image.mjs <image>');
        process.exit(1);
    }

    await pullWithRetry();

    try {
        run('docker', [
            'run',
            '--rm',
            '--detach',
            '--name', containerName,
            '--publish', `${host}:${hostPort}:6683`,
            '--env', 'OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true',
            image
        ]);

        await waitForReady();
        await assertOpenMode();
        await assertClientShell();
        await assertGraphql();
        console.log(`Docker smoke test passed: ${image}`);
    } finally {
        cleanup();
    }
}

main().catch(error => {
    console.error(error);
    cleanup();
    process.exit(1);
});
