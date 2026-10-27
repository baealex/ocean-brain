-- Preserve saved view identities and settings while replacing the old domain names.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;

CREATE TABLE "ViewGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "ViewGroup" SELECT "id", "title", "order", "createdAt", "updatedAt" FROM "ViewTab";

CREATE TABLE "View" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "displayType" TEXT NOT NULL DEFAULT 'list',
    "query" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'and',
    "limit" INTEGER NOT NULL DEFAULT 5,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "View_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ViewGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "View" SELECT "id", "tabId", "title", "displayType", "query", "mode", "limit", "order", "createdAt", "updatedAt" FROM "ViewSection";

CREATE TABLE "ViewTagFilter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "viewId" INTEGER NOT NULL,
    "tagName" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewTagFilter_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "ViewTagFilter" SELECT "id", "sectionId", "name", "order", "createdAt", "updatedAt" FROM "ViewSectionTag";

CREATE TABLE "new_ViewWorkspace" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "activeGroupId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewWorkspace_activeGroupId_fkey" FOREIGN KEY ("activeGroupId") REFERENCES "ViewGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ViewWorkspace" SELECT "id", "activeTabId", "createdAt", "updatedAt" FROM "ViewWorkspace";

-- Preserve the sequence even when the highest previously allocated ID was deleted.
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'ViewTab'), seq)) WHERE name = 'ViewGroup';
INSERT INTO sqlite_sequence (name, seq) SELECT 'ViewGroup', seq FROM sqlite_sequence WHERE name = 'ViewTab' AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'ViewGroup');
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'ViewSection'), seq)) WHERE name = 'View';
INSERT INTO sqlite_sequence (name, seq) SELECT 'View', seq FROM sqlite_sequence WHERE name = 'ViewSection' AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'View');
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'ViewSectionTag'), seq)) WHERE name = 'ViewTagFilter';
INSERT INTO sqlite_sequence (name, seq) SELECT 'ViewTagFilter', seq FROM sqlite_sequence WHERE name = 'ViewSectionTag' AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'ViewTagFilter');

DROP TABLE "ViewSectionTag";
DROP TABLE "ViewSection";
DROP TABLE "ViewWorkspace";
DROP TABLE "ViewTab";
ALTER TABLE "new_ViewWorkspace" RENAME TO "ViewWorkspace";

CREATE INDEX "ViewGroup_order_createdAt_idx" ON "ViewGroup"("order", "createdAt");
CREATE INDEX "View_groupId_order_createdAt_idx" ON "View"("groupId", "order", "createdAt");
CREATE INDEX "ViewTagFilter_viewId_order_createdAt_idx" ON "ViewTagFilter"("viewId", "order", "createdAt");
COMMIT;
PRAGMA foreign_keys=ON;
