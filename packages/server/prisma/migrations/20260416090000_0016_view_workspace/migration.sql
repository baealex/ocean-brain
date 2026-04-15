-- CreateTable
CREATE TABLE "ViewTab" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ViewWorkspace" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "activeTabId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewWorkspace_activeTabId_fkey" FOREIGN KEY ("activeTabId") REFERENCES "ViewTab" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViewSection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tabId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'and',
    "limit" INTEGER NOT NULL DEFAULT 5,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewSection_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "ViewTab" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViewSectionTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sectionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewSectionTag_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ViewSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ViewTab_order_createdAt_idx" ON "ViewTab"("order", "createdAt");

-- CreateIndex
CREATE INDEX "ViewSection_tabId_order_createdAt_idx" ON "ViewSection"("tabId", "order", "createdAt");

-- CreateIndex
CREATE INDEX "ViewSectionTag_sectionId_order_createdAt_idx" ON "ViewSectionTag"("sectionId", "order", "createdAt");
