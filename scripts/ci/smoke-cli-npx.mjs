#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

const [, , tarballArg] = process.argv;

if (!tarballArg) {
    console.error('Usage: node scripts/ci/smoke-cli-npx.mjs <path-to-cli-tarball>');
    process.exit(1);
}

const tarballPath = path.resolve(tarballArg);
const host = '127.0.0.1';
const port = Number(process.env.CLI_SMOKE_PORT ?? '6683');
const rootUrl = `http://${host}:${port}`;
const isWindows = process.platform === 'win32';
const readyTimeoutMs = Number(
    process.env.CLI_SMOKE_READY_TIMEOUT_MS ?? (isWindows ? '300000' : '120000')
);

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-smoke-'));
const dataDir = path.join(tempRoot, 'data');
const imageDir = path.join(dataDir, 'assets', 'images');
mkdirSync(imageDir, { recursive: true });

const npxArgs = [
    '--yes',
    '--package',
    tarballPath,
    'ocean-brain',
    'serve',
    '--port',
    String(port),
    '--host',
    host
];

const child = spawn(
    isWindows ? 'cmd.exe' : 'npx',
    isWindows
        ? ['/d', '/s', '/c', 'npx', ...npxArgs]
        : npxArgs,
    {
        detached: !isWindows,
        env: {
            ...process.env,
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForReady(timeoutMs) {
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

async function stopProcess() {
    if (child.exitCode !== null || child.signalCode !== null) return;

    if (process.platform === 'win32') {
        child.kill('SIGTERM');
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
            child.kill('SIGKILL');
        } else {
            try {
                process.kill(-child.pid, 'SIGKILL');
            } catch {
                child.kill('SIGKILL');
            }
        }
    }
}

async function main() {
    try {
        await waitForReady(readyTimeoutMs);
        await assertGraphql();
        console.log('CLI smoke test passed.');
    } catch (error) {
        if (stderrBuffer.length > 0) {
            console.error('\n--- CLI stderr ---');
            console.error(stderrBuffer);
            console.error('--- end stderr ---\n');
        }
        throw error;
    } finally {
        await stopProcess();
        rmSync(tempRoot, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
