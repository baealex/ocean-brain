import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const migration = (name: string) =>
    readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
const renameSql = migration('20261027060000_0023_view_names');

const legacyDatabase = () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys=ON;');
    db.exec(migration('20260416090000_0016_view_workspace'));
    db.exec(migration('20260531073000_0018_view_query'));
    db.exec(`
        INSERT INTO ViewTab VALUES (7, 'Project A', 2, '2026-01-01', '2026-10-01');
        INSERT INTO ViewTab VALUES (99, 'Deleted', 3, '2026-01-01', '2026-10-01');
        DELETE FROM ViewTab WHERE id=99;
        INSERT INTO ViewWorkspace VALUES (1, 7, '2026-01-01', '2026-10-01');
    `);
    for (const [index, format] of ['list', 'table', 'board', 'calendar'].entries()) {
        db.prepare(
            'INSERT INTO ViewSection (id, tabId, title, displayType, query, mode, "limit", "order", createdAt, updatedAt) VALUES (?, 7, ?, ?, ?, ?, 10, ?, ?, ?)',
        ).run(
            42 + index,
            format,
            format,
            JSON.stringify({
                sortBy: 'title',
                sortOrder: 'asc',
                propertyFilters: [{ key: 'project', valueType: 'select', operator: 'equals', value: 'project-a' }],
                displayOptions: {
                    tablePropertyKeys: ['status'],
                    boardGroupByPropertyKey: 'status',
                    calendarDateField: 'updatedAt',
                },
            }),
            'or',
            index,
            '2026-01-01',
            '2026-10-01',
        );
    }
    db.exec(`
        INSERT INTO ViewSectionTag VALUES (71, 42, '@meeting', 1, '2026-01-01', '2026-10-01');
        INSERT INTO ViewSectionTag VALUES (150, 42, '@deleted', 2, '2026-01-01', '2026-10-01');
        DELETE FROM ViewSectionTag WHERE id=150;
        INSERT INTO ViewSection (id, tabId, title, updatedAt) VALUES (99, 7, 'Deleted', '2026-10-01');
        DELETE FROM ViewSection WHERE id=99;
    `);
    return db;
};

const rows = (db: DatabaseSync, sql: string) =>
    db
        .prepare(sql)
        .all()
        .map((row) => ({ ...row }));

test('view name migration preserves saved identities, query settings, tags and active selection', () => {
    const db = legacyDatabase();
    try {
        const groups = rows(db, 'SELECT * FROM ViewTab');
        const views = rows(db, 'SELECT * FROM ViewSection ORDER BY id');
        const tags = rows(db, 'SELECT * FROM ViewSectionTag');

        db.exec(renameSql);

        assert.deepEqual(rows(db, 'SELECT * FROM ViewGroup'), groups);
        assert.deepEqual(
            rows(
                db,
                'SELECT id, groupId AS tabId, title, mode, "limit", "order", createdAt, updatedAt, displayType, query FROM "View" ORDER BY id',
            ),
            views,
        );
        assert.deepEqual(
            rows(
                db,
                'SELECT id, viewId AS sectionId, tagName AS name, "order", createdAt, updatedAt FROM ViewTagFilter',
            ),
            tags,
        );
        assert.equal(db.prepare('SELECT activeGroupId FROM ViewWorkspace').get()?.activeGroupId, 7);
        assert.deepEqual(rows(db, 'PRAGMA foreign_key_check'), []);
        assert.deepEqual(
            rows(
                db,
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ViewTab','ViewSection','ViewSectionTag','ViewTag')",
            ),
            [],
        );

        db.exec('DELETE FROM ViewGroup WHERE id=7');
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM "View"').get()?.count, 0);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ViewTagFilter').get()?.count, 0);
        assert.equal(db.prepare('SELECT activeGroupId FROM ViewWorkspace').get()?.activeGroupId, null);
    } finally {
        db.close();
    }
});

test('view name migration does not reuse previously deleted IDs, including empty tables', () => {
    for (const empty of [false, true]) {
        const db = legacyDatabase();
        try {
            if (empty) db.exec('DELETE FROM ViewTab;');

            db.exec(renameSql);

            const group = db.prepare('INSERT INTO ViewGroup (title, updatedAt) VALUES (?, ?)').run('New', '2026-10-27');
            const view = db
                .prepare('INSERT INTO "View" (groupId, title, updatedAt) VALUES (?, ?, ?)')
                .run(group.lastInsertRowid, 'New', '2026-10-27');
            const tag = db
                .prepare('INSERT INTO ViewTagFilter (viewId, tagName, updatedAt) VALUES (?, ?, ?)')
                .run(view.lastInsertRowid, '@new', '2026-10-27');
            assert.equal(group.lastInsertRowid, 100);
            assert.equal(view.lastInsertRowid, 100);
            assert.equal(tag.lastInsertRowid, 151);
            assert.deepEqual(rows(db, 'PRAGMA foreign_key_check'), []);
        } finally {
            db.close();
        }
    }
});
