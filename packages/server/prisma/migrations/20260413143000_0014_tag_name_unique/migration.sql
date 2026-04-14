CREATE TEMP TABLE "_TagDuplicateMap" AS
SELECT
    duplicate."id" AS "duplicateId",
    grouped."canonicalId" AS "canonicalId"
FROM "Tag" AS duplicate
JOIN (
    SELECT
        "name",
        MIN("id") AS "canonicalId"
    FROM "Tag"
    GROUP BY "name"
) AS grouped
    ON grouped."name" = duplicate."name"
WHERE duplicate."id" <> grouped."canonicalId";

INSERT OR IGNORE INTO "_NoteToTag" ("A", "B")
SELECT
    relation."A",
    duplicateMap."canonicalId"
FROM "_NoteToTag" AS relation
JOIN "_TagDuplicateMap" AS duplicateMap
    ON duplicateMap."duplicateId" = relation."B";

DELETE FROM "Tag"
WHERE "id" IN (
    SELECT "duplicateId"
    FROM "_TagDuplicateMap"
);

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

DROP TABLE "_TagDuplicateMap";
