-- CreateTable
CREATE TABLE "PropertyDefinition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PropertyOption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "propertyDefinitionId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyOption_propertyDefinitionId_fkey" FOREIGN KEY ("propertyDefinitionId") REFERENCES "PropertyDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteProperty" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "noteId" INTEGER NOT NULL,
    "propertyDefinitionId" INTEGER NOT NULL,
    "optionId" INTEGER,
    "textValue" TEXT,
    "textValueNormalized" TEXT,
    "numberValue" REAL,
    "dateValue" DATETIME,
    "boolValue" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NoteProperty_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoteProperty_propertyDefinitionId_fkey" FOREIGN KEY ("propertyDefinitionId") REFERENCES "PropertyDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoteProperty_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PropertyOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeletedNoteProperty" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deletedNoteId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "textValue" TEXT,
    "textValueNormalized" TEXT,
    "numberValue" REAL,
    "dateValue" DATETIME,
    "boolValue" BOOLEAN,
    "optionValue" TEXT,
    "optionLabel" TEXT,
    "optionColor" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeletedNoteProperty_deletedNoteId_fkey" FOREIGN KEY ("deletedNoteId") REFERENCES "DeletedNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyDefinition_key_key" ON "PropertyDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyOption_propertyDefinitionId_value_key" ON "PropertyOption"("propertyDefinitionId", "value");

-- CreateIndex
CREATE INDEX "PropertyOption_propertyDefinitionId_order_idx" ON "PropertyOption"("propertyDefinitionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "NoteProperty_noteId_propertyDefinitionId_key" ON "NoteProperty"("noteId", "propertyDefinitionId");

-- CreateIndex
CREATE INDEX "NoteProperty_propertyDefinitionId_noteId_idx" ON "NoteProperty"("propertyDefinitionId", "noteId");

-- CreateIndex
CREATE INDEX "NoteProperty_propertyDefinitionId_textValueNormalized_noteId_idx" ON "NoteProperty"("propertyDefinitionId", "textValueNormalized", "noteId");

-- CreateIndex
CREATE INDEX "NoteProperty_propertyDefinitionId_numberValue_noteId_idx" ON "NoteProperty"("propertyDefinitionId", "numberValue", "noteId");

-- CreateIndex
CREATE INDEX "NoteProperty_propertyDefinitionId_dateValue_noteId_idx" ON "NoteProperty"("propertyDefinitionId", "dateValue", "noteId");

-- CreateIndex
CREATE INDEX "NoteProperty_propertyDefinitionId_boolValue_noteId_idx" ON "NoteProperty"("propertyDefinitionId", "boolValue", "noteId");

-- CreateIndex
CREATE INDEX "NoteProperty_propertyDefinitionId_optionId_noteId_idx" ON "NoteProperty"("propertyDefinitionId", "optionId", "noteId");

-- CreateIndex
CREATE UNIQUE INDEX "DeletedNoteProperty_deletedNoteId_key_key" ON "DeletedNoteProperty"("deletedNoteId", "key");

-- CreateIndex
CREATE INDEX "DeletedNoteProperty_deletedNoteId_idx" ON "DeletedNoteProperty"("deletedNoteId");

-- CreateIndex
CREATE INDEX "Note_updatedAt_id_idx" ON "Note"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "Note_createdAt_id_idx" ON "Note"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Note_pinned_updatedAt_id_idx" ON "Note"("pinned", "updatedAt", "id");
