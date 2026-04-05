import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Command } from 'commander';
import { resolveServeAuthEnvironment } from './auth-options.js';
import { resolveMcpBearerToken } from './mcp-auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..', 'server');

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
    .option('--allow-insecure-no-auth', 'explicitly disable auth protection for local or trusted environments')
    .action(async (opts) => {
        try {
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

            const authEnvironment = resolveServeAuthEnvironment(opts, process.env);

            if (authEnvironment.OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH) {
                process.env.OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH = authEnvironment.OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH;
            }

            const serverEntry = pathToFileURL(path.resolve(serverRoot, 'dist/start.js')).href;
            await import(serverEntry);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown CLI auth configuration error';
            process.stderr.write(`[auth] Serve startup failed: ${message}\n`);
            process.exit(1);
        }
    });

program
    .command('mcp')
    .description('Start MCP server for AI integration')
    .option('-s, --server <url>', 'Ocean Brain server URL', 'http://localhost:6683')
    .option('--token-file <path>', 'read the MCP bearer token from a file')
    .option('--token-env <name>', 'environment variable name to read the MCP bearer token from', 'OCEAN_BRAIN_MCP_TOKEN')
    .option('--token <token>', 'explicit MCP bearer token fallback')
    .option('--write-safety-dir <path>', 'directory for pending MCP write confirmations and operation logs')
    .action(async (opts) => {
        const { startMcpServer } = await import('./mcp.js');
        const token = resolveMcpBearerToken(opts, process.env);
        const writeSafetyDir = opts.writeSafetyDir || process.env.OCEAN_BRAIN_MCP_WRITE_SAFETY_DIR;
        await startMcpServer(opts.server, token, { writeSafetyDir });
    });

program.parse();
