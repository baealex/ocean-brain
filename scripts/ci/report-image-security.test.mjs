import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./report-image-security.mjs', import.meta.url));
const scan = (vulnerabilities = []) => ({
    Metadata: { OS: { Family: 'debian' } },
    Results: [
        { Class: 'os-pkgs', Packages: [{ Name: 'libc6' }] },
        { Class: 'lang-pkgs', Packages: [{ Name: 'example' }], Vulnerabilities: vulnerabilities },
    ],
});

function runReport(report) {
    const directory = mkdtempSync(path.join(tmpdir(), 'image-security-report-'));
    try {
        const input = path.join(directory, 'report.json');
        const output = path.join(directory, 'output');
        const summary = path.join(directory, 'summary');
        writeFileSync(input, JSON.stringify(report));
        writeFileSync(output, '');
        writeFileSync(summary, '');
        const result = spawnSync(process.execPath, [script, input, 'example@sha256:digest'], {
            encoding: 'utf8',
            env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
        });
        return { ...result, output: readFileSync(output, 'utf8'), summary: readFileSync(summary, 'utf8') };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

test('a complete clean scan produces a non-blocking result', () => {
    const result = runReport(scan());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.output, /^blocking_count=0\n$/);
    assert.match(result.summary, /1 OS packages and 1 application libraries/);
});

test('fixable HIGH and CRITICAL findings block while all other findings stay visible', () => {
    const findings = [
        { PkgName: 'high', VulnerabilityID: 'HIGH-1', Severity: 'HIGH', FixedVersion: '2.0.0' },
        { PkgName: 'critical', VulnerabilityID: 'CRITICAL-1', Severity: 'CRITICAL', FixedVersion: '2.0.0' },
        { PkgName: 'unfixed', VulnerabilityID: 'HIGH-2', Severity: 'HIGH' },
        { PkgName: 'medium', VulnerabilityID: 'MEDIUM-1', Severity: 'MEDIUM', FixedVersion: '2.0.0' },
    ];
    const result = runReport(scan(findings));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'blocking_count=2\n');
    assert.match(result.summary, /HIGH-2/);
    assert.match(result.summary, /Findings without a fix: \*\*1\*\*/);
    assert.match(result.summary, /\| MEDIUM \| 1 \| 1 \|/);
});

test('a scan with no package inventory cannot masquerade as clean', () => {
    const result = runReport({ Metadata: { OS: { Family: 'debian' } }, Results: [] });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must inventory both/);
    assert.equal(result.output, '');
});

test('missing application library coverage fails closed', () => {
    const report = scan();
    report.Results.pop();
    const result = runReport(report);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must inventory both/);
});

test('a malformed scanner result cannot produce a passing gate output', () => {
    const result = runReport({});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /did not produce a results array/);
    assert.equal(result.output, '');
});
