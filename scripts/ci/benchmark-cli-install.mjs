#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
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

const resolveNpmCliPath = () => {
    const executableDir = path.dirname(process.execPath);
    const candidates = [
        process.env.npm_execpath?.endsWith('npm-cli.js') ? process.env.npm_execpath : undefined,
        path.resolve(executableDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        path.resolve(executableDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        process.env.APPDATA
            ? path.resolve(process.env.APPDATA, 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js')
            : undefined,
    ].filter(Boolean);
    const npmCliPath = candidates.find((candidate) => existsSync(candidate));

    if (!npmCliPath) {
        throw new Error(`Unable to locate npm-cli.js. Checked: ${candidates.join(', ')}`);
    }

    return npmCliPath;
};

const resolveInstalledCliEntry = (prefix) => {
    const candidates = [
        path.join(prefix, 'node_modules', 'ocean-brain', 'dist', 'index.js'),
        path.join(prefix, 'lib', 'node_modules', 'ocean-brain', 'dist', 'index.js'),
    ];
    const cliEntry = candidates.find((candidate) => existsSync(candidate));

    if (!cliEntry) {
        throw new Error(`Unable to locate the installed Ocean Brain CLI. Checked: ${candidates.join(', ')}`);
    }

    return cliEntry;
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

const metricSummary = (values) => ({
    median: median(values),
    minimum: Math.min(...values),
    maximum: Math.max(...values),
});

const summarize = (runs, tarball) => ({
    tarballBytes: statSync(tarball).size,
    installMs: metricSummary(runs.map((run) => run.installMs)),
    launchMs: metricSummary(runs.map((run) => run.launchMs)),
    npmCacheBytes: metricSummary(runs.map((run) => run.npmCacheBytes)),
    installedBytes: metricSummary(runs.map((run) => run.installedBytes)),
    installedFiles: metricSummary(runs.map((run) => run.installedFiles)),
});

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
const formatMs = (milliseconds) => `${(milliseconds / 1000).toFixed(2)} s`;
const formatCount = (value) => Math.round(value).toLocaleString('en-US');
const formatMetric = (summary, formatter) => {
    const formattedMedian = formatter(summary.median);
    if (summary.minimum === summary.maximum) return formattedMedian;
    return `${formattedMedian} (${formatter(summary.minimum)}–${formatter(summary.maximum)})`;
};
const improvement = (baseline, candidate) => ((baseline - candidate) / baseline) * 100;
const formatImprovement = (baseline, candidate) => {
    const value = improvement(baseline, candidate);
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const baselineTarball = resolveTarball(positionalArgs[0]);
const candidateTarball = resolveTarball(positionalArgs[1]);
const benchmarkRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-cli-benchmark-'));
const npmCliPath = resolveNpmCliPath();
const platformLabel = {
    darwin: 'macOS',
    linux: 'Linux',
    win32: 'Windows',
}[process.platform] ?? process.platform;
const results = { baseline: [], candidate: [] };
const rawRuns = [];

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
        process.execPath,
        [
            npmCliPath,
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
    const executable = resolveInstalledCliEntry(prefix);

    const launchStartedAt = performance.now();
    const version = runCommand(process.execPath, [executable, '--version'], { env, timeoutMs: 60_000 });
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
            rawRuns.push({ label, result, trial });
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
const npmVersion = runCommand(process.execPath, [npmCliPath, '--version']);
const runnerImage = [process.env.ImageOS, process.env.ImageVersion].filter(Boolean).join(' ');
const rawSampleRows = rawRuns.map(({ label, result, trial }) => [
    `| ${trial}`,
    label,
    formatMs(result.installMs),
    formatBytes(result.npmCacheBytes),
    formatCount(result.installedFiles),
    formatBytes(result.installedBytes),
    `${formatMs(result.launchMs)} |`,
].join(' | '));
const summary = [
    `## ${platformLabel} CLI cold-install benchmark`,
    '',
    `Median (range) of ${trials} isolated-cache trial${trials === 1 ? '' : 's'} on Node ${process.version} / npm ${npmVersion}${runnerImage ? ` / ${runnerImage}` : ''}.`,
    'The timer starts from an already-downloaded local Ocean Brain tarball with an empty dependency cache; registry metadata and transfer of the root tarball are excluded.',
    '',
    '| Metric | Baseline | Bundled candidate | Improvement |',
    '| --- | ---: | ---: | ---: |',
    `| Package tarball | ${formatBytes(baseline.tarballBytes)} | ${formatBytes(candidate.tarballBytes)} | ${formatImprovement(baseline.tarballBytes, candidate.tarballBytes)} |`,
    `| Cold dependency install from local tarball | ${formatMetric(baseline.installMs, formatMs)} | ${formatMetric(candidate.installMs, formatMs)} | ${formatImprovement(baseline.installMs.median, candidate.installMs.median)} |`,
    `| Cold npm cache footprint | ${formatMetric(baseline.npmCacheBytes, formatBytes)} | ${formatMetric(candidate.npmCacheBytes, formatBytes)} | ${formatImprovement(baseline.npmCacheBytes.median, candidate.npmCacheBytes.median)} |`,
    `| Installed files | ${formatMetric(baseline.installedFiles, formatCount)} | ${formatMetric(candidate.installedFiles, formatCount)} | ${formatImprovement(baseline.installedFiles.median, candidate.installedFiles.median)} |`,
    `| Installed size | ${formatMetric(baseline.installedBytes, formatBytes)} | ${formatMetric(candidate.installedBytes, formatBytes)} | ${formatImprovement(baseline.installedBytes.median, candidate.installedBytes.median)} |`,
    `| CLI launch (informational) | ${formatMetric(baseline.launchMs, formatMs)} | ${formatMetric(candidate.launchMs, formatMs)} | — |`,
    '',
    'Positive improvement means the bundled candidate is smaller or faster.',
    'The isolated npm cache footprint is a download-volume proxy, not exact wire bytes.',
    'CLI launch is a single process start per install and is reported only as a diagnostic, not a performance claim.',
    '',
    '### Raw samples',
    '',
    '| Trial | Variant | Install | npm cache | Files | Installed size | CLI launch |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: |',
    ...rawSampleRows,
].join('\n');

console.log(`\n${summary}`);

if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
