#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { appendFileSync, lstatSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
const trialsFlagIndex = args.indexOf('--trials');
const trials = trialsFlagIndex === -1 ? 3 : Number(args[trialsFlagIndex + 1]);
const positionalArgs = [...args];

if (trialsFlagIndex !== -1) {
    positionalArgs.splice(trialsFlagIndex, 2);
}

if (positionalArgs.length !== 2 || !Number.isInteger(trials) || trials < 1) {
    console.error('Usage: node scripts/ci/benchmark-cli-install.mjs <baseline-tarball-or-dir> <candidate-tarball-or-dir> [--trials N]');
    process.exit(1);
}

const resolveTarball = (input) => {
    const resolved = path.resolve(input);
    const stats = statSync(resolved);

    if (stats.isFile()) {
        return resolved;
    }

    const tarballs = readdirSync(resolved)
        .filter((entry) => entry.endsWith('.tgz'))
        .map((entry) => path.join(resolved, entry));

    if (tarballs.length !== 1) {
        throw new Error(`Expected exactly one .tgz in ${resolved}, found ${tarballs.length}.`);
    }

    return tarballs[0];
};

const runCommand = (command, commandArgs, options = {}) => {
    const result = spawnSync(command, commandArgs, {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        shell: process.platform === 'win32',
        timeout: options.timeoutMs ?? 10 * 60 * 1000,
        env: options.env ?? process.env,
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error([
            `${command} ${commandArgs.join(' ')} failed with exit code ${result.status}.`,
            result.stdout,
            result.stderr,
        ].filter(Boolean).join('\n'));
    }

    return result.stdout.trim();
};

const measureTree = (root) => {
    const pending = [root];
    let bytes = 0;
    let files = 0;

    while (pending.length > 0) {
        const current = pending.pop();

        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const entryPath = path.join(current, entry.name);

            if (entry.isDirectory()) {
                pending.push(entryPath);
                continue;
            }

            const stats = lstatSync(entryPath);
            bytes += stats.size;
            files += 1;
        }
    }

    return { bytes, files };
};

const median = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const summarize = (runs, tarball) => ({
    tarballBytes: statSync(tarball).size,
    installMs: median(runs.map((run) => run.installMs)),
    launchMs: median(runs.map((run) => run.launchMs)),
    npmCacheBytes: median(runs.map((run) => run.npmCacheBytes)),
    installedBytes: median(runs.map((run) => run.installedBytes)),
    installedFiles: median(runs.map((run) => run.installedFiles)),
});

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
const formatMs = (milliseconds) => `${(milliseconds / 1000).toFixed(2)} s`;
const improvement = (baseline, candidate) => ((baseline - candidate) / baseline) * 100;
const formatImprovement = (baseline, candidate) => {
    const value = improvement(baseline, candidate);
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const baselineTarball = resolveTarball(positionalArgs[0]);
const candidateTarball = resolveTarball(positionalArgs[1]);
const benchmarkRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-cli-benchmark-'));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const platformLabel = {
    darwin: 'macOS',
    linux: 'Linux',
    win32: 'Windows',
}[process.platform] ?? process.platform;
const results = { baseline: [], candidate: [] };

const benchmarkInstall = (label, tarball, trial) => {
    const runRoot = path.join(benchmarkRoot, `${trial}-${label}`);
    const prefix = path.join(runRoot, 'prefix');
    const npmCacheDir = path.join(runRoot, 'npm-cache');
    const env = {
        ...process.env,
        NO_UPDATE_NOTIFIER: '1',
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
    };

    const installStartedAt = performance.now();
    runCommand(
        npmCommand,
        [
            'install',
            '--global',
            '--prefix',
            prefix,
            '--cache',
            npmCacheDir,
            '--no-audit',
            '--no-fund',
            '--loglevel',
            'error',
            tarball,
        ],
        { env },
    );
    const installMs = performance.now() - installStartedAt;
    const installed = measureTree(prefix);
    const npmCache = measureTree(npmCacheDir);
    const executable = process.platform === 'win32'
        ? path.join(prefix, 'ocean-brain.cmd')
        : path.join(prefix, 'bin', 'ocean-brain');

    const launchStartedAt = performance.now();
    const version = runCommand(executable, ['--version'], { env, timeoutMs: 60_000 });
    const launchMs = performance.now() - launchStartedAt;

    if (!/^\d+\.\d+\.\d+/.test(version)) {
        throw new Error(`${label} CLI returned an unexpected version: ${version}`);
    }

    return {
        installMs,
        launchMs,
        npmCacheBytes: npmCache.bytes,
        installedBytes: installed.bytes,
        installedFiles: installed.files,
        version,
    };
};

try {
    for (let trial = 1; trial <= trials; trial += 1) {
        const order = trial % 2 === 1
            ? [['baseline', baselineTarball], ['candidate', candidateTarball]]
            : [['candidate', candidateTarball], ['baseline', baselineTarball]];

        for (const [label, tarball] of order) {
            console.log(`Running cold install ${trial}/${trials}: ${label}`);
            const result = benchmarkInstall(label, tarball, trial);
            results[label].push(result);
            console.log(
                `${label}: install=${formatMs(result.installMs)}, launch=${formatMs(result.launchMs)}, ` +
                `cache=${formatBytes(result.npmCacheBytes)}, files=${result.installedFiles}, ` +
                `size=${formatBytes(result.installedBytes)}`,
            );
        }
    }
} finally {
    rmSync(benchmarkRoot, { recursive: true, force: true, maxRetries: 3 });
}

const baseline = summarize(results.baseline, baselineTarball);
const candidate = summarize(results.candidate, candidateTarball);
const summary = [
    `## ${platformLabel} CLI cold-install benchmark`,
    '',
    `Median of ${trials} isolated-cache trial${trials === 1 ? '' : 's'} on Node ${process.version} / npm ${runCommand(npmCommand, ['--version'])}.`,
    '',
    '| Metric | Baseline | Bundled candidate | Improvement |',
    '| --- | ---: | ---: | ---: |',
    `| Package tarball | ${formatBytes(baseline.tarballBytes)} | ${formatBytes(candidate.tarballBytes)} | ${formatImprovement(baseline.tarballBytes, candidate.tarballBytes)} |`,
    `| Cold global install | ${formatMs(baseline.installMs)} | ${formatMs(candidate.installMs)} | ${formatImprovement(baseline.installMs, candidate.installMs)} |`,
    `| Cold npm cache footprint | ${formatBytes(baseline.npmCacheBytes)} | ${formatBytes(candidate.npmCacheBytes)} | ${formatImprovement(baseline.npmCacheBytes, candidate.npmCacheBytes)} |`,
    `| Installed files | ${Math.round(baseline.installedFiles).toLocaleString('en-US')} | ${Math.round(candidate.installedFiles).toLocaleString('en-US')} | ${formatImprovement(baseline.installedFiles, candidate.installedFiles)} |`,
    `| Installed size | ${formatBytes(baseline.installedBytes)} | ${formatBytes(candidate.installedBytes)} | ${formatImprovement(baseline.installedBytes, candidate.installedBytes)} |`,
    `| CLI launch | ${formatMs(baseline.launchMs)} | ${formatMs(candidate.launchMs)} | ${formatImprovement(baseline.launchMs, candidate.launchMs)} |`,
    '',
    'Positive improvement means the bundled candidate is smaller or faster.',
    'The isolated npm cache footprint is a download-volume proxy, not exact wire bytes.',
].join('\n');

console.log(`\n${summary}`);

if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
