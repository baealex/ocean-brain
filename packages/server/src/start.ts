import { runPrismaMigrateDeploy } from './modules/prisma-runtime.js';

try {
    runPrismaMigrateDeploy();
    await import('./main.js');
} catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Prisma startup error';
    process.stderr.write(`[prisma] Startup failed: ${message}\n`);
    process.exit(1);
}
