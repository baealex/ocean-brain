-- Start from the order the workspace list already shows.
ALTER TABLE "Workspace" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

UPDATE "Workspace" SET "order" = (
    SELECT COUNT(*) FROM "Workspace" AS "earlier"
    WHERE "earlier"."createdAt" < "Workspace"."createdAt"
        OR ("earlier"."createdAt" = "Workspace"."createdAt" AND "earlier"."id" < "Workspace"."id")
);
