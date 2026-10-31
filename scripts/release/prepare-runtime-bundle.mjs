import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));

export const prepareRuntimeBundle = () => {
    const root = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const cli = JSON.parse(readFileSync(path.join(rootDir, 'packages', 'cli', 'package.json'), 'utf8'));
    const dependencies = Object.fromEntries(cli.bundleDependencies.map(name => {
        const installed = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8'));
        return [name, installed.version];
    }));
    const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'cli-runtime-bundle-'));
    const runNpm = (args) => execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
        cwd: temporaryDirectory,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    try {
        writeFileSync(path.join(temporaryDirectory, 'package.json'), JSON.stringify({
            private: true,
            dependencies,
            overrides: root.pnpm.overrides,
        }));
        // Ship JavaScript only; Prisma generates/downloads engines for the installation platform.
        runNpm(['install', '--ignore-scripts', '--no-fund', '--no-audit']);
        runNpm(['audit']);
        const destination = path.join(rootDir, 'packages', 'cli', 'node_modules');
        rmSync(destination, { recursive: true, force: true });
        cpSync(path.join(temporaryDirectory, 'node_modules'), destination, { recursive: true });
    } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareRuntimeBundle();
