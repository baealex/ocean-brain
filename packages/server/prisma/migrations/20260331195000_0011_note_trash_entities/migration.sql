CREATE TABLE "DeletedNote" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "layout" TEXT NOT NULL DEFAULT 'wide'
);

CREATE TABLE "DeletedNoteTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deletedNoteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "DeletedNoteTag_deletedNoteId_fkey" FOREIGN KEY ("deletedNoteId") REFERENCES "DeletedNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DeletedReminder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deletedNoteId" INTEGER NOT NULL,
    "originalId" INTEGER,
    "reminderDate" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "content" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeletedReminder_deletedNoteId_fkey" FOREIGN KEY ("deletedNoteId") REFERENCES "DeletedNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DeletedNote_deletedAt_updatedAt_idx" ON "DeletedNote"("deletedAt", "updatedAt");
CREATE INDEX "DeletedNoteTag_deletedNoteId_idx" ON "DeletedNoteTag"("deletedNoteId");
CREATE INDEX "DeletedReminder_deletedNoteId_idx" ON "DeletedReminder"("deletedNoteId");
