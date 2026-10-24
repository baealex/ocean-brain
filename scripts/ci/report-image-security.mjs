#!/usr/bin/env node

import { appendFileSync, readFileSync } from 'node:fs';

const [reportPath, imageRef] = process.argv.slice(2);
if (!reportPath || !imageRef) {
    throw new Error('Usage: node scripts/ci/report-image-security.mjs <report.json> <image-ref>');
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const results = report.Results;
if (!Array.isArray(results)) {
    throw new Error('Image scan did not produce a results array');
}

const packagesFor = (kind) => results
    .filter(result => result.Class === kind)
    .flatMap(result => result.Packages ?? []);
const osPackages = packagesFor('os-pkgs');
const libraryPackages = packagesFor('lang-pkgs');
if (!report.Metadata?.OS?.Family || osPackages.length === 0 || libraryPackages.length === 0) {
    throw new Error('Image scan must inventory both OS packages and application libraries');
}

const findings = results.flatMap(result => result.Vulnerabilities ?? []);
const hasFix = finding => typeof finding.FixedVersion === 'string' && finding.FixedVersion.trim() !== '';
const isHighSeverity = finding => ['HIGH', 'CRITICAL'].includes(finding.Severity);
const blockers = findings.filter(finding => isHighSeverity(finding) && hasFix(finding));
const unfixed = findings.filter(finding => !hasFix(finding));
const escape = value => String(value ?? '').replace(/[|\r\n`<>]/g, ' ');
const lines = [
    '### Docker image vulnerability scan',
    '',
    `Image: ${escape(imageRef)}`,
    '',
    `Inventoried ${osPackages.length} OS packages and ${libraryPackages.length} application libraries.`,
    '',
    '| Severity | Findings | With a fix |',
    '| --- | ---: | ---: |',
    ...['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].map(severity => {
        const matches = findings.filter(finding => finding.Severity === severity);
        return `| ${severity} | ${matches.length} | ${matches.filter(hasFix).length} |`;
    }),
    '',
    `Blocking findings: **${blockers.length}** (HIGH/CRITICAL with a published fix).`,
    `Findings without a fix: **${unfixed.length}**; retained in the full JSON and SARIF reports.`,
    '',
];

const highFindings = findings.filter(isHighSeverity);
if (highFindings.length > 0) {
    lines.push(
        '| Package | Advisory | Installed | Fixed |',
        '| --- | --- | --- | --- |',
        ...highFindings.slice(0, 40).map(finding =>
            `| ${escape(finding.PkgName)} | ${escape(finding.VulnerabilityID)} | ${escape(finding.InstalledVersion)} | ${escape(finding.FixedVersion || 'Not available')} |`),
        '',
    );
    if (highFindings.length > 40) {
        lines.push('The table shows the first 40 high-severity findings. Download the report artifact for all findings.', '');
    }
}

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}
if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `blocking_count=${blockers.length}\n`);
}
