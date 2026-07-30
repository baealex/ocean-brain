CREATE TABLE "NoteReference" (
    "sourceNoteId" INTEGER NOT NULL,
    "targetNoteId" INTEGER NOT NULL,

    PRIMARY KEY ("sourceNoteId", "targetNoteId"),
    CONSTRAINT "NoteReference_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NoteReference_targetNoteId_sourceNoteId_idx" ON "NoteReference"("targetNoteId", "sourceNoteId");

CREATE TABLE "NoteReferenceIndexState" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
