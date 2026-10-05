import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));

export const preparePrismaBundle = () => {
    const root = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const prisma = JSON.parse(readFileSync(require.resolve('prisma/package.json'), 'utf8'));
    const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'cli-prisma-bundle-'));
    const runNpm = (args) => execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
        cwd: temporaryDirectory,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    try {
        writeFileSync(path.join(temporaryDirectory, 'package.json'), JSON.stringify({
            private: true,
            dependencies: { prisma: prisma.version },
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) preparePrismaBundle();
