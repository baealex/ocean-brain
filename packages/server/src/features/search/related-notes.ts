import models, { Prisma } from '~/models.js';

const MAX_RELATED_NOTES = 5;

export interface SearchRelatedNoteSource {
    id: number;
    tags: Array<{ id: number; name: string }>;
}

export interface SearchRelatedNoteCandidate {
    id: number;
    title: string;
    updatedAt: Date;
    linked: boolean;
    backlink: boolean;
    sharedTagNames: string[];
}

interface RelatedNotesDependencies {
    findSourceNote: (noteId: number) => Promise<SearchRelatedNoteSource | null>;
    findCandidates: (input: {
        noteId: number;
        tagIds: number[];
        limit: number;
    }) => Promise<SearchRelatedNoteCandidate[]>;
}

interface RawSearchRelatedNoteCandidate {
    id: number;
    title: string;
    updatedAt: Date | string;
    linked: number;
    backlink: number;
    sharedTagCount: number | bigint;
}

const normalizeLimit = (limit: number) => Math.min(MAX_RELATED_NOTES, Math.max(0, Math.trunc(limit)));

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

const buildReasons = (candidate: SearchRelatedNoteCandidate) => {
    const reasons: string[] = [];

    if (candidate.linked) {
        reasons.push('Linked from this note');
    }

    if (candidate.backlink) {
        reasons.push('Backlink to this note');
    }

    for (const tagName of candidate.sharedTagNames) {
        reasons.push(`Shares ${tagName}`);
    }

    return reasons;
};

const compareCandidates = (left: SearchRelatedNoteCandidate, right: SearchRelatedNoteCandidate) => {
    const leftScore = (left.linked ? 100 : 0) + (left.backlink ? 100 : 0) + left.sharedTagNames.length * 20;
    const rightScore = (right.linked ? 100 : 0) + (right.backlink ? 100 : 0) + right.sharedTagNames.length * 20;

    if (leftScore !== rightScore) {
        return rightScore - leftScore;
    }

    const updatedAtDifference = right.updatedAt.getTime() - left.updatedAt.getTime();
    return updatedAtDifference !== 0 ? updatedAtDifference : left.id - right.id;
};

const findCandidatesFromIndex = async ({
    noteId,
    tagIds,
    limit,
}: Parameters<NonNullable<RelatedNotesDependencies['findCandidates']>>[0]) => {
    const rows =
        tagIds.length === 0
            ? await models.$queryRaw<RawSearchRelatedNoteCandidate[]>(Prisma.sql`
                  WITH candidate_scores AS (
                      SELECT
                          note."id" AS "id",
                          note."title" AS "title",
                          note."updatedAt" AS "updatedAt",
                          CASE WHEN EXISTS (
                              SELECT 1
                              FROM "NoteReference" AS outgoing
                              WHERE outgoing."sourceNoteId" = ${noteId}
                                AND outgoing."targetNoteId" = note."id"
                          ) THEN 1 ELSE 0 END AS "linked",
                          CASE WHEN EXISTS (
                              SELECT 1
                              FROM "NoteReference" AS incoming
                              WHERE incoming."targetNoteId" = ${noteId}
                                AND incoming."sourceNoteId" = note."id"
                          ) THEN 1 ELSE 0 END AS "backlink",
                          0 AS "sharedTagCount"
                      FROM "Note" AS note
                      WHERE note."id" <> ${noteId}
                        AND (
                            EXISTS (
                                SELECT 1
                                FROM "NoteReference" AS outgoing
                                WHERE outgoing."sourceNoteId" = ${noteId}
                                  AND outgoing."targetNoteId" = note."id"
                            )
                            OR EXISTS (
                                SELECT 1
                                FROM "NoteReference" AS incoming
                                WHERE incoming."targetNoteId" = ${noteId}
                                  AND incoming."sourceNoteId" = note."id"
                            )
                        )
                  )
                  SELECT *, ("linked" * 100 + "backlink" * 100 + "sharedTagCount" * 20) AS "score"
                  FROM candidate_scores
                  ORDER BY "score" DESC, "updatedAt" DESC, "id" ASC
                  LIMIT ${limit}
              `)
            : await models.$queryRaw<RawSearchRelatedNoteCandidate[]>(Prisma.sql`
                  WITH candidate_scores AS (
                      SELECT
                          note."id" AS "id",
                          note."title" AS "title",
                          note."updatedAt" AS "updatedAt",
                          CASE WHEN EXISTS (
                              SELECT 1
                              FROM "NoteReference" AS outgoing
                              WHERE outgoing."sourceNoteId" = ${noteId}
                                AND outgoing."targetNoteId" = note."id"
                          ) THEN 1 ELSE 0 END AS "linked",
                          CASE WHEN EXISTS (
                              SELECT 1
                              FROM "NoteReference" AS incoming
                              WHERE incoming."targetNoteId" = ${noteId}
                                AND incoming."sourceNoteId" = note."id"
                          ) THEN 1 ELSE 0 END AS "backlink",
                          COUNT(DISTINCT noteTags."B") AS "sharedTagCount"
                      FROM "Note" AS note
                      LEFT JOIN "_NoteToTag" AS noteTags
                        ON noteTags."A" = note."id"
                       AND noteTags."B" IN (${Prisma.join(tagIds)})
                      WHERE note."id" <> ${noteId}
                        AND (
                            EXISTS (
                                SELECT 1
                                FROM "NoteReference" AS outgoing
                                WHERE outgoing."sourceNoteId" = ${noteId}
                                  AND outgoing."targetNoteId" = note."id"
                            )
                            OR EXISTS (
                                SELECT 1
                                FROM "NoteReference" AS incoming
                                WHERE incoming."targetNoteId" = ${noteId}
                                  AND incoming."sourceNoteId" = note."id"
                            )
                            OR noteTags."B" IS NOT NULL
                        )
                      GROUP BY note."id", note."title", note."updatedAt"
                  )
                  SELECT *, ("linked" * 100 + "backlink" * 100 + "sharedTagCount" * 20) AS "score"
                  FROM candidate_scores
                  ORDER BY "score" DESC, "updatedAt" DESC, "id" ASC
                  LIMIT ${limit}
              `);

    if (rows.length === 0) {
        return [];
    }

    const candidateIds = rows.map((row) => row.id);
    const candidateNotes = await models.note.findMany({
        where: { id: { in: candidateIds } },
        select: {
            id: true,
            tags: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    const tagsByNoteId = new Map(candidateNotes.map((note) => [note.id, note.tags]));
    const sourceTagIds = new Set(tagIds);

    return rows.map((row) => ({
        id: row.id,
        title: row.title || 'Untitled',
        updatedAt: toDate(row.updatedAt),
        linked: Number(row.linked) === 1,
        backlink: Number(row.backlink) === 1,
        sharedTagNames: (tagsByNoteId.get(row.id) ?? [])
            .filter((tag) => sourceTagIds.has(tag.id))
            .map((tag) => tag.name)
            .sort((left, right) => left.localeCompare(right)),
    }));
};

const defaultDependencies: RelatedNotesDependencies = {
    findSourceNote: (noteId) =>
        models.note.findUnique({
            where: { id: noteId },
            select: {
                id: true,
                tags: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        }),
    findCandidates: findCandidatesFromIndex,
};

export const createSearchRelatedNotes = (dependencies: RelatedNotesDependencies = defaultDependencies) => {
    return async (noteId: number, limit = MAX_RELATED_NOTES) => {
        const normalizedLimit = normalizeLimit(limit);

        if (!Number.isSafeInteger(noteId) || noteId <= 0 || normalizedLimit === 0) {
            return [];
        }

        const source = await dependencies.findSourceNote(noteId);

        if (!source) {
            return [];
        }

        const candidates = await dependencies.findCandidates({
            noteId,
            tagIds: source.tags.map((tag) => tag.id),
            limit: normalizedLimit,
        });

        return candidates
            .filter((candidate) => candidate.linked || candidate.backlink || candidate.sharedTagNames.length > 0)
            .sort(compareCandidates)
            .slice(0, normalizedLimit)
            .map((candidate) => ({
                id: candidate.id,
                title: candidate.title || 'Untitled',
                reasons: buildReasons(candidate),
            }));
    };
};

export const searchRelatedNotes = createSearchRelatedNotes();
