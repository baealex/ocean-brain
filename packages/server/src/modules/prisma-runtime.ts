import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

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

const resolveServerRoot = () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    return process.env.OCEAN_BRAIN_PACKAGE_ROOT || path.resolve(__dirname, '../..');
};

export const resolvePrismaSchemaPath = () => {
    return path.resolve(resolveServerRoot(), 'prisma/schema.prisma');
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
