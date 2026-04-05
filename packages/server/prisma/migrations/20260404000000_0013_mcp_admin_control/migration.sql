CREATE TABLE "McpToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME
);

CREATE INDEX "McpToken_revokedAt_createdAt_idx" ON "McpToken"("revokedAt", "createdAt");
