import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import { paths } from '../paths.js';

interface PrismaRuntimeDeps {
    execFileSync: (
        file: string,
        args: string[],
        options: {
            env: NodeJS.ProcessEnv;
            stdio: 'inherit';
        },
    ) => void;
    resolvePrismaCliEntry: () => string;
}

export const resolvePrismaSchemaPath = () => {
    return path.resolve(paths.packageRoot, 'prisma/schema.prisma');
};

export const resolvePrismaCliEntry = () => {
    const require = createRequire(import.meta.url);
    return require.resolve('prisma/build/index.js');
};

export const createPrismaRuntime = (deps: PrismaRuntimeDeps) => ({
    runMigrateDeploy: () => {
        deps.execFileSync(
            process.execPath,
            [deps.resolvePrismaCliEntry(), 'migrate', 'deploy', `--schema=${resolvePrismaSchemaPath()}`],
            {
                stdio: 'inherit',
                env: { ...process.env },
            },
        );
    },
});

const defaultPrismaRuntime = createPrismaRuntime({
    execFileSync,
    resolvePrismaCliEntry,
});

export const runPrismaMigrateDeploy = () => {
    defaultPrismaRuntime.runMigrateDeploy();
};
