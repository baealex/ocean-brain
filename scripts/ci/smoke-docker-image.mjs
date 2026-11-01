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
// Set to true to test a locally built image that is not in a registry.
const skipPull = process.env.DOCKER_SMOKE_SKIP_PULL === 'true';
const appRoot = '/usr/local/lib/node_modules/ocean-brain';

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

async function assertSearchAdminStatus() {
    const response = await fetch(`${rootUrl}/api/search-admin/status`, {
        signal: AbortSignal.timeout(5000)
    });
    const bodyText = await response.text();

    if (response.status !== 200) {
        throw new Error(`/api/search-admin/status returned HTTP ${response.status}: ${bodyText}`);
    }

    let body;
    try {
        body = JSON.parse(bodyText);
    } catch {
        throw new Error(`/api/search-admin/status returned invalid JSON: ${bodyText}`);
    }

    if (typeof body.phase !== 'string' || typeof body.available !== 'boolean') {
        throw new Error(`/api/search-admin/status returned unexpected payload: ${bodyText}`);
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

async function requestGraphql(query, variables) {
    const response = await fetch(`${rootUrl}/graphql`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
    });
    const bodyText = await response.text();

    if (response.status !== 200) {
        throw new Error(`/graphql returned HTTP ${response.status}: ${bodyText}`);
    }

    const body = JSON.parse(bodyText);
    if (body.errors) {
        throw new Error(`GraphQL returned errors: ${bodyText}`);
    }

    return body.data;
}

async function assertNoteMarkdownRoundTrip() {
    const content = JSON.stringify([
        {
            id: 'smoke-heading',
            type: 'heading',
            props: { level: 1 },
            content: [{ type: 'text', text: 'Docker smoke note', styles: {} }],
            children: []
        },
        {
            id: 'smoke-item',
            type: 'bulletListItem',
            props: {},
            content: [{ type: 'text', text: 'Saved through Prisma', styles: { bold: true } }],
            children: []
        }
    ]);

    const created = await requestGraphql(
        'mutation SmokeCreateNote($note: NoteInput!) { createNote(note: $note) { id } }',
        { note: { title: 'Docker smoke note', content } }
    );
    const read = await requestGraphql(
        'query SmokeReadNote($id: ID!) { note(id: $id) { contentAsMarkdown } }',
        { id: created.createNote.id }
    );

    const markdown = read.note.contentAsMarkdown;
    for (const expected of ['# Docker smoke note', '**Saved through Prisma**']) {
        if (!markdown.includes(expected)) {
            throw new Error(`Note Markdown is missing ${JSON.stringify(expected)}: ${JSON.stringify(markdown)}`);
        }
    }

    console.log('Note write and Markdown verification passed');
}

async function waitForOfflineReady(name) {
    const deadline = Date.now() + readyTimeoutMs;
    const probe = `fetch('http://127.0.0.1:6683/api/auth/session')
        .then(response => process.exit(response.status === 200 ? 0 : 1), () => process.exit(1))`;

    while (Date.now() < deadline) {
        const state = spawnSync('docker', ['inspect', '--format', '{{.State.Running}}', name], {
            encoding: 'utf8'
        });
        if (state.stdout?.trim() !== 'true') {
            throw new Error('Container stopped during offline startup');
        }

        const result = spawnSync('docker', ['exec', name, '/nodejs/bin/node', '-e', probe], {
            stdio: 'ignore'
        });
        if (result.status === 0) return;

        await sleep(1000);
    }

    throw new Error(`Docker image did not become ready offline within ${readyTimeoutMs}ms`);
}

// Without network access, startup cannot download a Prisma engine missing from the image.
async function assertOfflineStartup() {
    const offlineContainerName = `${containerName}-offline`;

    run('docker', [
        'run',
        '--detach',
        '--name', offlineContainerName,
        '--network', 'none',
        '--env', 'OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true',
        image
    ]);

    try {
        await waitForOfflineReady(offlineContainerName);

        const { stdout } = run('docker', ['diff', offlineContainerName], { stdio: 'pipe' });
        const appChanges = stdout.split('\n').filter(line => line.includes(`${appRoot}/`));
        if (appChanges.length > 0) {
            throw new Error(`Offline startup changed installed app files:\n${appChanges.join('\n')}`);
        }

        console.log('Offline startup verification passed');
    } catch (error) {
        spawnSync('docker', ['logs', offlineContainerName], { stdio: 'inherit' });
        throw error;
    } finally {
        spawnSync('docker', ['rm', '-f', offlineContainerName], { stdio: 'ignore' });
    }
}

function assertNodeRuntime() {
    const script = `
        const [major, minor, patch] = process.versions.node.split('.').map(Number);
        if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) {
            throw new Error('Docker runtime must use Node.js 24.22.1 or newer in the 24.x release line; found ' + process.version);
        }
        if (require('node:zlib').constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH !== -17) {
            throw new Error('Docker runtime is missing the Brotli CVE-2026-111497 fix');
        }
        console.log('Node.js runtime verification passed: ' + process.version + ' (' + process.arch + ')');
    `;

    run('docker', [
        'run',
        '--rm',
        '--entrypoint', '/nodejs/bin/node',
        image,
        '-e', script
    ]);
}

function assertSqliteVectorExtension() {
    const appModules = `${appRoot}/node_modules`;
    const script = `
        const { DatabaseSync } = require('node:sqlite');
        const { getLoadablePath } = require('${appModules}/sqlite-vec');
        const database = new DatabaseSync(':memory:', { allowExtension: true });

        database.loadExtension(getLoadablePath());
        database.enableLoadExtension(false);
        const row = database
            .prepare("SELECT vec_version() AS version, vec_distance_cosine('[1,0]', '[0,1]') AS distance")
            .get();
        if (!row.version || row.distance !== 1) {
            throw new Error('Unexpected sqlite-vec result: ' + JSON.stringify(row));
        }

        console.log('sqlite-vec verification passed: ' + JSON.stringify(row));
        database.close();
    `;

    run('docker', [
        'run',
        '--rm',
        '--entrypoint', '/nodejs/bin/node',
        image,
        '-e', script
    ]);
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

    if (skipPull) {
        console.log(`Skipping docker pull for local image: ${image}`);
    } else {
        await pullWithRetry();
    }

    try {
        assertNodeRuntime();
        assertSqliteVectorExtension();
        await assertOfflineStartup();
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
        await assertSearchAdminStatus();
        await assertGraphql();
        await assertNoteMarkdownRoundTrip();
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
