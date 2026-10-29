-- Keep every existing identity, relationship and recovery payload in the default workspace.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
CREATE TEMP TABLE workspace_sequences AS SELECT name, seq FROM sqlite_sequence
WHERE name IN ('Note', 'DeletedNote', 'PropertyDefinition', 'ViewGroup');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "Workspace" ("id", "name", "updatedAt") VALUES (1, 'Notes', CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "ViewDashboardState" (
    "workspaceId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "activeGroupId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewDashboardState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ViewDashboardState_activeGroupId_fkey" FOREIGN KEY ("activeGroupId") REFERENCES "ViewGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "ViewDashboardState" ("workspaceId", "activeGroupId", "createdAt", "updatedAt")
SELECT 1, "activeGroupId", "createdAt", "updatedAt" FROM "ViewWorkspace" WHERE "id"=1;
INSERT INTO "ViewDashboardState" ("workspaceId", "updatedAt")
SELECT 1, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM "ViewDashboardState" WHERE "workspaceId"=1);
DROP TABLE "ViewWorkspace";

-- RedefineTables
CREATE TABLE "new_Note" (
    "workspaceId" INTEGER NOT NULL DEFAULT 1,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "searchableText" TEXT NOT NULL DEFAULT '',
    "searchableTextVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "layout" TEXT NOT NULL DEFAULT 'wide',
    CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("content", "createdAt", "id", "layout", "order", "pinned", "searchableText", "searchableTextVersion", "title", "updatedAt") SELECT "content", "createdAt", "id", "layout", "order", "pinned", "searchableText", "searchableTextVersion", "title", "updatedAt" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_workspaceId_updatedAt_id_idx" ON "Note"("workspaceId", "updatedAt", "id");
CREATE INDEX "Note_workspaceId_createdAt_id_idx" ON "Note"("workspaceId", "createdAt", "id");
CREATE INDEX "Note_workspaceId_pinned_updatedAt_id_idx" ON "Note"("workspaceId", "pinned", "updatedAt", "id");
CREATE INDEX "Note_updatedAt_id_idx" ON "Note"("updatedAt", "id");
CREATE INDEX "Note_createdAt_id_idx" ON "Note"("createdAt", "id");
CREATE INDEX "Note_pinned_updatedAt_id_idx" ON "Note"("pinned", "updatedAt", "id");
CREATE TABLE "new_PropertyDefinition" (
    "workspaceId" INTEGER NOT NULL DEFAULT 1,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PropertyDefinition" ("createdAt", "id", "key", "name", "updatedAt", "valueType") SELECT "createdAt", "id", "key", "name", "updatedAt", "valueType" FROM "PropertyDefinition";
DROP TABLE "PropertyDefinition";
ALTER TABLE "new_PropertyDefinition" RENAME TO "PropertyDefinition";
CREATE UNIQUE INDEX "PropertyDefinition_key_key" ON "PropertyDefinition"("key");
CREATE INDEX "PropertyDefinition_workspaceId_key_idx" ON "PropertyDefinition"("workspaceId", "key");
CREATE TABLE "new_DeletedNote" (
    "workspaceId" INTEGER NOT NULL DEFAULT 1,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "layout" TEXT NOT NULL DEFAULT 'wide',
    CONSTRAINT "DeletedNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DeletedNote" ("content", "createdAt", "deletedAt", "id", "layout", "order", "pinned", "title", "updatedAt") SELECT "content", "createdAt", "deletedAt", "id", "layout", "order", "pinned", "title", "updatedAt" FROM "DeletedNote";
DROP TABLE "DeletedNote";
ALTER TABLE "new_DeletedNote" RENAME TO "DeletedNote";
CREATE INDEX "DeletedNote_workspaceId_deletedAt_updatedAt_idx" ON "DeletedNote"("workspaceId", "deletedAt", "updatedAt");
CREATE INDEX "DeletedNote_deletedAt_updatedAt_idx" ON "DeletedNote"("deletedAt", "updatedAt");
CREATE TABLE "new_ViewGroup" (
    "workspaceId" INTEGER NOT NULL DEFAULT 1,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ViewGroup" ("createdAt", "id", "order", "title", "updatedAt") SELECT "createdAt", "id", "order", "title", "updatedAt" FROM "ViewGroup";
DROP TABLE "ViewGroup";
ALTER TABLE "new_ViewGroup" RENAME TO "ViewGroup";
CREATE INDEX "ViewGroup_workspaceId_order_createdAt_idx" ON "ViewGroup"("workspaceId", "order", "createdAt");
CREATE INDEX "ViewGroup_order_createdAt_idx" ON "ViewGroup"("order", "createdAt");

-- Rebuilding a table must not reuse IDs that were allocated and subsequently deleted.
UPDATE sqlite_sequence SET seq=MAX(seq, COALESCE((SELECT seq FROM workspace_sequences WHERE name=sqlite_sequence.name), seq))
WHERE name IN ('Note', 'DeletedNote', 'PropertyDefinition', 'ViewGroup');
INSERT INTO sqlite_sequence(name,seq)
SELECT name,seq FROM workspace_sequences WHERE name NOT IN (SELECT name FROM sqlite_sequence);
DROP TABLE workspace_sequences;

-- Constraint failures roll back the whole migration, rather than returning diagnostic rows only.
CREATE TEMP TABLE workspace_integrity (violations INTEGER CHECK (violations=0));
INSERT OR ROLLBACK INTO workspace_integrity SELECT COUNT(*) FROM pragma_foreign_key_check;
INSERT OR ROLLBACK INTO workspace_integrity SELECT COUNT(*) FROM pragma_integrity_check WHERE integrity_check != 'ok';
DROP TABLE workspace_integrity;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_key_check;
