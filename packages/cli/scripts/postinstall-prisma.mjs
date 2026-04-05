import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const resolveSchemaPath = (packageRoot, doesExist = existsSync) => {
    const candidates = [
        path.join(packageRoot, 'server', 'prisma', 'schema.prisma'),
        path.resolve(packageRoot, '..', 'server', 'prisma', 'schema.prisma')
    ];

    const match = candidates.find((candidate) => doesExist(candidate));
    if (!match) {
        throw new Error(
            `Unable to locate Prisma schema for CLI postinstall. Tried: ${candidates.join(', ')}`
        );
    }

    return match;
};

const runPrismaGenerate = () => {
    const packageRoot = process.cwd();
    const schemaPath = resolveSchemaPath(packageRoot);
    const require = createRequire(import.meta.url);
    const prismaCliEntry = require.resolve('prisma/build/index.js');

    execFileSync(
        process.execPath,
        [prismaCliEntry, 'generate', `--schema=${schemaPath}`],
        {
            stdio: 'inherit',
            env: process.env
        }
    );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runPrismaGenerate();
}
