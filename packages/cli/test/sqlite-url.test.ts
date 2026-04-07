import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

import { resolveSqliteDatabaseUrl } from '../src/sqlite-url.js';

test('resolveSqliteDatabaseUrl uses a file URL for posix paths', () => {
    const dbPath = '/tmp/ocean-brain db.sqlite3';

    assert.equal(
        resolveSqliteDatabaseUrl(dbPath, 'darwin'),
        pathToFileURL(dbPath).href
    );
});

test('resolveSqliteDatabaseUrl normalizes Windows paths to a file URL', () => {
    assert.equal(
        resolveSqliteDatabaseUrl('C:\\Users\\runneradmin\\AppData\\Local\\Temp\\ocean brain\\db.sqlite3', 'win32'),
        'file:///C:/Users/runneradmin/AppData/Local/Temp/ocean%20brain/db.sqlite3'
    );
});
