import test from 'node:test';
import assert from 'node:assert/strict';

import { createPrismaRuntime } from '../src/modules/prisma-runtime.js';

test('prisma runtime invokes migrate deploy through the Prisma CLI entry', () => {
    const calls: Array<{
        file: string;
        args: string[];
        options: {
            env: NodeJS.ProcessEnv;
            stdio: 'inherit';
        };
    }> = [];

    const runtime = createPrismaRuntime({
        execFileSync: (file, args, options) => {
            calls.push({
                file,
                args,
                options
            });
        },
        resolvePrismaCliEntry: () => '/virtual/prisma/build/index.js'
    });

    runtime.runMigrateDeploy();

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.file, process.execPath);
    assert.equal(calls[0]?.args[0], '/virtual/prisma/build/index.js');
    assert.equal(calls[0]?.args[1], 'migrate');
    assert.equal(calls[0]?.args[2], 'deploy');
    assert.match(calls[0]?.args[3] ?? '', /--schema=.*packages[\\/]server[\\/]prisma[\\/]schema\.prisma$/);
    assert.equal(calls[0]?.options.stdio, 'inherit');
});
