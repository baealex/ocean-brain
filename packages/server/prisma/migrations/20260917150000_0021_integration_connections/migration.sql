-- Rename the existing platform in place: preserve connection IDs, grants,
-- credential hashes and timestamps, including MCP credentials migrated by 0020.
BEGIN IMMEDIATE;

ALTER TABLE "PluginInstallation" RENAME TO "IntegrationConnection";
ALTER TABLE "IntegrationConnection" RENAME COLUMN "pluginId" TO "integrationId";

-- SQLite cannot rename a foreign-key constraint; copy the credential rows
-- unchanged so the resulting table also matches Prisma's canonical schema.
CREATE TABLE "IntegrationCredential" (
    "connectionId" TEXT NOT NULL PRIMARY KEY,
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    CONSTRAINT "IntegrationCredential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "IntegrationCredential" ("connectionId", "id", "tokenHash", "createdAt", "lastUsedAt")
SELECT "installationId", "id", "tokenHash", "createdAt", "lastUsedAt" FROM "PluginCredential";
DROP TABLE "PluginCredential";

DROP INDEX "PluginInstallation_pluginId_idx";
CREATE INDEX "IntegrationConnection_integrationId_idx" ON "IntegrationConnection"("integrationId");

CREATE UNIQUE INDEX "IntegrationCredential_id_key" ON "IntegrationCredential"("id");
CREATE UNIQUE INDEX "IntegrationCredential_tokenHash_key" ON "IntegrationCredential"("tokenHash");

COMMIT;
