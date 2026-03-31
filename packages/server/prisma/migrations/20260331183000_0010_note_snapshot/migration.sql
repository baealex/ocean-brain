CREATE TABLE "NoteSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "noteId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "editSessionId" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteSnapshot_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NoteSnapshot_noteId_createdAt_idx" ON "NoteSnapshot"("noteId", "createdAt");
CREATE UNIQUE INDEX "NoteSnapshot_noteId_editSessionId_key" ON "NoteSnapshot"("noteId", "editSessionId");
