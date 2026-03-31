CREATE TEMP TABLE "_ImageDuplicateMap" AS
SELECT
    duplicate."id" AS "duplicateId",
    duplicate."url" AS "duplicateUrl",
    canonical."id" AS "canonicalId",
    canonical."url" AS "canonicalUrl",
    ROW_NUMBER() OVER (ORDER BY duplicate."id") AS "position"
FROM "Image" AS duplicate
JOIN (
    SELECT "hash", MIN("id") AS "canonicalId"
    FROM "Image"
    GROUP BY "hash"
) AS grouped
    ON grouped."hash" = duplicate."hash"
JOIN "Image" AS canonical
    ON canonical."id" = grouped."canonicalId"
WHERE duplicate."id" <> grouped."canonicalId";

WITH RECURSIVE "rewritten"("noteId", "position", "content") AS (
    SELECT "id", 0, "content"
    FROM "Note"
    UNION ALL
    SELECT
        "rewritten"."noteId",
        "_ImageDuplicateMap"."position",
        replace("rewritten"."content", "_ImageDuplicateMap"."duplicateUrl", "_ImageDuplicateMap"."canonicalUrl")
    FROM "rewritten"
    JOIN "_ImageDuplicateMap"
        ON "_ImageDuplicateMap"."position" = "rewritten"."position" + 1
)
UPDATE "Note"
SET "content" = (
    SELECT "rewritten"."content"
    FROM "rewritten"
    WHERE "rewritten"."noteId" = "Note"."id"
    ORDER BY "rewritten"."position" DESC
    LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM "_ImageDuplicateMap");

DELETE FROM "Image"
WHERE "id" IN (
    SELECT "duplicateId"
    FROM "_ImageDuplicateMap"
);

CREATE UNIQUE INDEX "Image_hash_key" ON "Image"("hash");

DROP TABLE "_ImageDuplicateMap";
