import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (!process.argv[2]) throw new Error('Provide a CLI tarball to audit.');
const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'cli-package-audit-'));
const runNpm = (args) => execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: temporaryDirectory,
    stdio: 'inherit',
    shell: process.platform === 'win32',
});
try {
    cpSync(path.resolve(process.argv[2]), path.join(temporaryDirectory, 'package.tgz'));
    writeFileSync(path.join(temporaryDirectory, 'package.json'), JSON.stringify({ private: true }));
    runNpm(['install', './package.tgz', '--package-lock-only', '--ignore-scripts', '--no-fund', '--no-audit']);
    runNpm(['audit']);
} finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
}
