ALTER TABLE "IntegrationConnection" ADD COLUMN "proxyUrl" TEXT;

-- The runner experiment never stored an app target in Ocean Brain, so keep
-- migrated connections disabled until the owner configures their private URL.
UPDATE "IntegrationConnection"
SET
    "manifest" = json_set("manifest", '$.launch.mode', 'proxied'),
    "enabled" = 0
WHERE json_extract("manifest", '$.launch.mode') = 'managed';
