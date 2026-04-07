import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const resolveSqliteDatabaseUrl = (
    dbPath: string,
    platform = process.platform
) => {
    if (platform === 'win32') {
        const normalizedPath = path.win32.resolve(dbPath).replace(/\\/g, '/');
        return new URL(`file:///${normalizedPath}`).href;
    }

    return pathToFileURL(path.resolve(dbPath)).href;
};
