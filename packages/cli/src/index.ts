import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..', 'server');

function findBin(name: string, fromDir: string): string {
    let dir = path.resolve(fromDir, '..');
    while (true) {
        const bin = path.resolve(dir, 'node_modules', '.bin', name);
        if (fs.existsSync(bin)) return bin;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    throw new Error(`Could not find "${name}" binary. Make sure it is installed.`);
}

const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
    .name('ocean-brain')
    .description('Self-hosted, open-source note-taking app with bi-directional links')
    .version(pkg.version);

program
    .command('serve', { isDefault: true })
    .description('Start the Ocean Brain server')
    .option('-p, --port <port>', 'port to listen on', '6683')
    .option('-H, --host <host>', 'host to bind to', '0.0.0.0')
    .action(async (opts) => {
        const defaultRoot = path.resolve(os.homedir(), '.ocean-brain');
        const dataDir = process.env.OCEAN_BRAIN_DATA_DIR || path.resolve(defaultRoot, 'data');
        const imageDir = process.env.OCEAN_BRAIN_IMAGE_DIR || path.resolve(defaultRoot, 'assets/images');
        const dbPath = path.resolve(dataDir, 'db.sqlite3');

        fs.mkdirSync(dataDir, { recursive: true });
        fs.mkdirSync(imageDir, { recursive: true });

        process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${dbPath}`;
        process.env.OCEAN_BRAIN_PACKAGE_ROOT = serverRoot;
        process.env.OCEAN_BRAIN_DATA_DIR = dataDir;
        process.env.OCEAN_BRAIN_IMAGE_DIR = imageDir;
        process.env.PORT = process.env.PORT || opts.port;
        process.env.HOST = process.env.HOST || opts.host;

        const schemaPath = path.resolve(serverRoot, 'prisma/schema.prisma');
        const prisma = findBin('prisma', __dirname);
        execSync(`"${prisma}" generate --schema="${schemaPath}"`, {
            stdio: 'inherit',
            env: { ...process.env }
        });
        execSync(`"${prisma}" migrate deploy --schema="${schemaPath}"`, {
            stdio: 'inherit',
            env: { ...process.env }
        });

        await import(path.resolve(serverRoot, 'dist/main.js'));
    });

program
    .command('mcp')
    .description('Start MCP server for AI integration')
    .option('-s, --server <url>', 'Ocean Brain server URL', 'http://localhost:6683')
    .action(async (opts) => {
        const { startMcpServer } = await import('./mcp.js');
        await startMcpServer(opts.server);
    });

program.parse();
