CREATE TABLE "PluginInstallation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pluginId" TEXT NOT NULL,
    "native" BOOLEAN NOT NULL DEFAULT false,
    "manifest" TEXT NOT NULL,
    "grantedPermissions" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "PluginInstallation_pluginId_idx" ON "PluginInstallation"("pluginId");

CREATE TABLE "PluginCredential" (
    "installationId" TEXT NOT NULL PRIMARY KEY,
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    CONSTRAINT "PluginCredential_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "PluginInstallation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PluginCredential_id_key" ON "PluginCredential"("id");
CREATE UNIQUE INDEX "PluginCredential_tokenHash_key" ON "PluginCredential"("tokenHash");

-- Keep legacy tables intact. Only the latest active token was accepted by MCP.
INSERT INTO "PluginInstallation" ("id", "pluginId", "native", "manifest", "grantedPermissions", "enabled", "updatedAt")
VALUES (
    'mcp', 'ocean-brain.mcp', true,
    '{"schemaVersion":1,"apiVersion":1,"id":"ocean-brain.mcp","name":"MCP","version":"1.0.0","description":"Connect AI clients to Ocean Brain.","permissions":["notes:read","notes:create","notes:update","notes:delete"]}',
    '["notes:read","notes:create","notes:update","notes:delete"]',
    COALESCE((SELECT "value" = 'true' FROM "Cache" WHERE "key" = 'MCP_ENABLED'), false),
    CURRENT_TIMESTAMP
);

INSERT INTO "PluginCredential" ("installationId", "id", "tokenHash", "createdAt", "lastUsedAt")
SELECT 'mcp', CAST("id" AS TEXT), "tokenHash", "createdAt", "lastUsedAt"
FROM "McpToken" WHERE "revokedAt" IS NULL ORDER BY "createdAt" DESC, "id" DESC LIMIT 1;
