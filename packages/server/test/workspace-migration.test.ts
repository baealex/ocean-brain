import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const directory = new URL('../prisma/migrations/', import.meta.url);
const migrationName = '20261029090000_0024_logical_workspaces';
const sql = (name: string) => readFileSync(new URL(`${name}/migration.sql`, directory), 'utf8');
const legacyDatabase = () => {
    const db = new DatabaseSync(':memory:');
    for (const name of readdirSync(directory)
        .filter((name) => /^\d/.test(name) && name < migrationName)
        .sort()) {
        db.exec(sql(name));
    }
    db.exec('PRAGMA foreign_keys=ON');
    return db;
};

test('workspace migration preserves all existing fields, references, recovery data and allocated IDs', () => {
    const db = legacyDatabase();
    try {
        db.exec(`
            INSERT INTO Note(id,title,content,updatedAt) VALUES (7,'Existing','[]','2026-10-28');
            INSERT INTO Note(id,title,content,updatedAt) VALUES (999,'Removed','[]','2026-10-28');
            DELETE FROM Note WHERE id=999;
            INSERT INTO PropertyDefinition(id,key,name,valueType,updatedAt) VALUES (3,'status','State','select','2026-10-28');
            INSERT INTO PropertyOption(id,propertyDefinitionId,label,value,updatedAt) VALUES (4,3,'Open','open','2026-10-28');
            INSERT INTO NoteProperty(noteId,propertyDefinitionId,optionId,updatedAt) VALUES (7,3,4,'2026-10-28');
            INSERT INTO NoteSnapshot(noteId,title,payload,editSessionId) VALUES (7,'Before','{"title":"Before","content":"[]"}','session');
            INSERT INTO NoteReference(sourceNoteId,targetNoteId) VALUES (7,7);
            INSERT INTO DeletedNote(id,title,content,createdAt,updatedAt) VALUES (9,'Trashed','[]','2026-10-27','2026-10-28');
            INSERT INTO DeletedNoteProperty(deletedNoteId,key,name,valueType,createdAt,updatedAt) VALUES (9,'weight','Weight','number','2026-10-27','2026-10-28');
            INSERT INTO ViewGroup(id,title,updatedAt) VALUES (6,'Existing views','2026-10-28');
            INSERT INTO "View"(id,groupId,title,query,updatedAt) VALUES (5,6,'Board','{"displayOptions":{"boardGroupByPropertyKey":"status"}}','2026-10-28');
            INSERT INTO ViewWorkspace(id,activeGroupId,updatedAt) VALUES (1,6,'2026-10-28');
        `);
        const tables = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .all();
        const before = tables.map(({ name }) => {
            const columns = db
                .prepare(`PRAGMA table_info("${name}")`)
                .all()
                .map(({ name }) => `"${name}"`)
                .join(',');
            return { name: String(name), columns, rows: db.prepare(`SELECT ${columns} FROM "${name}"`).all() };
        });

        db.exec(sql(migrationName));

        for (const table of before.filter(({ name }) => name !== 'ViewWorkspace')) {
            assert.deepEqual(db.prepare(`SELECT ${table.columns} FROM "${table.name}"`).all(), table.rows, table.name);
        }
        for (const table of ['Note', 'DeletedNote', 'PropertyDefinition', 'ViewGroup']) {
            assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE workspaceId != 1`).get()?.n, 0);
        }
        assert.equal(
            db.prepare('SELECT activeGroupId FROM ViewDashboardState WHERE workspaceId=1').get()?.activeGroupId,
            6,
        );
        assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Workspace').get()?.n, 1);
        assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
        assert.equal(db.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
        assert.equal(
            db.prepare("INSERT INTO Note(title,content,updatedAt) VALUES ('After','[]','2026-10-29')").run()
                .lastInsertRowid,
            1000,
        );
    } finally {
        db.close();
    }
});

test('fresh installation has one default workspace without requiring saved views', () => {
    const db = legacyDatabase();
    try {
        db.exec(sql(migrationName));
        assert.equal(db.prepare('SELECT id FROM Workspace').get()?.id, 1);
        assert.equal(db.prepare('SELECT workspaceId FROM ViewDashboardState').get()?.workspaceId, 1);
        assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
        db.close();
    }
});

test('a failed integrity check rolls back the whole workspace migration', () => {
    const db = legacyDatabase();
    try {
        db.exec(`PRAGMA foreign_keys=OFF;
            INSERT INTO NoteReference(sourceNoteId,targetNoteId) VALUES (999,7);
        `);

        assert.throws(() => db.exec(sql(migrationName)), /CHECK constraint failed/);

        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='Workspace'").get()?.n, 0);
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='ViewWorkspace'").get()?.n, 1);
        assert.equal(db.prepare('SELECT sourceNoteId FROM NoteReference').get()?.sourceNoteId, 999);
    } finally {
        db.close();
    }
});
