import models from '~/models.js';
import { trashNoteById as moveNoteToTrashById } from './note-trash.js';

export interface NoteCleanupBackReference {
    id: string;
    title: string;
}

export interface NoteCleanupPreview {
    id: string;
    title: string;
    updatedAt: string;
    pinned: boolean;
    tagNames: string[];
    reminderCount: number;
    backReferences: NoteCleanupBackReference[];
    orphanedTagNames: string[];
    requiresForce: boolean;
    forceReasons: string[];
}

export interface NoteCleanupCandidate {
    id: string;
    title: string;
    updatedAt: string;
    pinned: boolean;
    tagNames: string[];
    reminderCount: number;
    backReferenceCount: number;
    matchedTerms: string[];
    reasons: string[];
    requiresForce: boolean;
    forceReasons: string[];
}

export interface NoteCleanupCandidatesResult {
    keywords: string[];
    limit: number;
    offset: number;
    olderThanDays: number;
    notes: NoteCleanupCandidate[];
    totalCount: number;
}

export interface NoteCleanupService {
    deleteNoteById: (id: number) => Promise<NoteCleanupPreview | null>;
    getDeletePreview: (id: number) => Promise<NoteCleanupPreview | null>;
    listCleanupCandidates: (input?: {
        keywords?: string[];
        limit?: number;
        offset?: number;
        olderThanDays?: number;
        query?: string;
    }) => Promise<NoteCleanupCandidatesResult>;
}

interface NoteRecord {
    id: number;
    title: string;
    content: string;
    updatedAt: Date;
    pinned: boolean;
    tags: Array<{
        id: number;
        name: string;
    }>;
}

interface NoteCleanupPreviewInternal extends NoteCleanupPreview {
    orphanedTagIds: number[];
}

const DEFAULT_CLEANUP_KEYWORDS = ['temp', 'temporary', 'tmp', 'draft', 'test', 'wip'];

export const normalizeCleanupKeywords = (keywords?: string[], query?: string) => {
    const queryKeywords = typeof query === 'string'
        ? query.split(/[,\s]+/).map((keyword) => keyword.trim())
        : [];
    const source = (keywords && keywords.length > 0)
        ? keywords
        : (queryKeywords.length > 0 ? queryKeywords : DEFAULT_CLEANUP_KEYWORDS);

    return Array.from(new Set(
        source
            .map((keyword) => keyword.trim().toLowerCase())
            .filter(Boolean)
    ));
};

const buildForceReasons = (input: {
    pinned: boolean;
    reminderCount: number;
    backReferenceCount: number;
}) => {
    const forceReasons: string[] = [];

    if (input.pinned) {
        forceReasons.push('note_is_pinned');
    }

    if (input.reminderCount > 0) {
        forceReasons.push('has_reminders');
    }

    if (input.backReferenceCount > 0) {
        forceReasons.push('has_back_references');
    }

    return forceReasons;
};

export const createNoteCleanupService = (deps: {
    countCandidateNotes: (keywords: string[], olderThanDays: number) => Promise<number>;
    countReminders: (noteId: number) => Promise<number>;
    deleteNoteAndPruneTags: (noteId: number, orphanTagIds: number[]) => Promise<void>;
    findBackReferences: (noteId: number) => Promise<Array<{ id: number; title: string }>>;
    findCandidateNotes: (keywords: string[], skip: number, take: number, olderThanDays: number) => Promise<NoteRecord[]>;
    findNote: (id: number) => Promise<NoteRecord | null>;
    getTagNoteCounts: (tagIds: number[]) => Promise<Map<number, number>>;
}): NoteCleanupService => {
    const buildCandidate = async (
        note: NoteRecord,
        matchedTerms?: string[]
    ): Promise<NoteCleanupCandidate> => {
        const [reminderCount, backReferences] = await Promise.all([
            deps.countReminders(note.id),
            deps.findBackReferences(note.id)
        ]);
        const normalizedMatchedTerms = matchedTerms ?? [];
        const forceReasons = buildForceReasons({
            pinned: note.pinned,
            reminderCount,
            backReferenceCount: backReferences.length
        });

        return {
            id: String(note.id),
            title: note.title,
            updatedAt: note.updatedAt.toISOString(),
            pinned: note.pinned,
            tagNames: note.tags.map((tag) => tag.name),
            reminderCount,
            backReferenceCount: backReferences.length,
            matchedTerms: normalizedMatchedTerms,
            reasons: [
                ...(normalizedMatchedTerms.length > 0 ? [`matched_terms:${normalizedMatchedTerms.join(',')}`] : []),
                ...(note.pinned ? [] : ['not_pinned']),
                ...(note.tags.length === 0 ? ['tagless'] : []),
                ...(reminderCount === 0 ? ['no_reminders'] : []),
                ...(backReferences.length === 0 ? ['no_back_references'] : [])
            ],
            requiresForce: forceReasons.length > 0,
            forceReasons
        };
    };

    const getDeletePreviewInternal = async (id: number): Promise<NoteCleanupPreviewInternal | null> => {
        const note = await deps.findNote(id);

        if (!note) {
            return null;
        }

        const [candidate, backReferences, tagNoteCounts] = await Promise.all([
            buildCandidate(note),
            deps.findBackReferences(note.id),
            deps.getTagNoteCounts(note.tags.map((tag) => tag.id))
        ]);

        const orphanedTags = note.tags.filter((tag) => (tagNoteCounts.get(tag.id) ?? 0) <= 1);

        return {
            id: candidate.id,
            title: candidate.title,
            updatedAt: candidate.updatedAt,
            pinned: candidate.pinned,
            tagNames: candidate.tagNames,
            reminderCount: candidate.reminderCount,
            backReferences: backReferences.map((backReference) => ({
                id: String(backReference.id),
                title: backReference.title
            })),
            orphanedTagNames: orphanedTags.map((tag) => tag.name),
            orphanedTagIds: orphanedTags.map((tag) => tag.id),
            requiresForce: candidate.requiresForce || orphanedTags.length > 0,
            forceReasons: [
                ...candidate.forceReasons,
                ...(orphanedTags.length > 0 ? ['orphan_tags'] : [])
            ]
        };
    };

    const getDeletePreview = async (id: number): Promise<NoteCleanupPreview | null> => {
        const preview = await getDeletePreviewInternal(id);

        if (!preview) {
            return null;
        }

        const { orphanedTagIds, ...publicPreview } = preview;
        void orphanedTagIds;
        return publicPreview;
    };

    return {
        listCleanupCandidates: async (input = {}) => {
            const limit = Math.max(1, Number(input.limit ?? 20));
            const offset = Math.max(0, Number(input.offset ?? 0));
            const olderThanDays = Math.max(0, Number(input.olderThanDays ?? 0));
            const keywords = normalizeCleanupKeywords(input.keywords, input.query);

            const [totalCount, notes] = await Promise.all([
                deps.countCandidateNotes(keywords, olderThanDays),
                deps.findCandidateNotes(keywords, offset, limit, olderThanDays)
            ]);

            const candidates = await Promise.all(notes.map((note) => {
                const haystack = `${note.title}\n${note.content}`.toLowerCase();
                const matchedTerms = keywords.filter((keyword) => haystack.includes(keyword));
                return buildCandidate(note, matchedTerms);
            }));

            return {
                keywords,
                limit,
                offset,
                olderThanDays,
                notes: candidates,
                totalCount
            };
        },
        getDeletePreview,
        deleteNoteById: async (id: number) => {
            const preview = await getDeletePreviewInternal(id);

            if (!preview) {
                return null;
            }

            await deps.deleteNoteAndPruneTags(id, preview.orphanedTagIds);

            const { orphanedTagIds, ...publicPreview } = preview;
            void orphanedTagIds;
            return publicPreview;
        }
    };
};

const buildKeywordClauses = (keywords: string[]) => {
    return keywords.flatMap((keyword) => ([
        { title: { contains: keyword } },
        { content: { contains: keyword } }
    ]));
};

const buildStaleWhere = (olderThanDays: number) => {
    if (olderThanDays <= 0) {
        return {};
    }

    return { updatedAt: { lte: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) } };
};

const noteCleanupService = createNoteCleanupService({
    countCandidateNotes: (keywords: string[], olderThanDays: number) => models.note.count({
        where: {
            ...buildStaleWhere(olderThanDays),
            OR: buildKeywordClauses(keywords)
        }
    }),
    countReminders: (noteId: number) => models.reminder.count({ where: { noteId } }),
    deleteNoteAndPruneTags: async (noteId: number, orphanTagIds: number[]) => {
        void orphanTagIds;
        await moveNoteToTrashById(noteId);
    },
    findBackReferences: (noteId: number) => models.note.findMany({
        select: {
            id: true,
            title: true
        },
        where: {
            content: { contains: `reference","props":{"id":"${noteId}"` },
            NOT: { id: noteId }
        },
        orderBy: [
            { pinned: 'desc' },
            { updatedAt: 'desc' }
        ]
    }),
    findCandidateNotes: (keywords: string[], skip: number, take: number, olderThanDays: number) => models.note.findMany({
        include: { tags: true },
        orderBy: { updatedAt: 'asc' },
        skip,
        take,
        where: {
            ...buildStaleWhere(olderThanDays),
            OR: buildKeywordClauses(keywords)
        }
    }),
    findNote: (id: number) => models.note.findUnique({
        where: { id },
        include: { tags: true }
    }),
    getTagNoteCounts: async (tagIds: number[]) => {
        if (tagIds.length === 0) {
            return new Map<number, number>();
        }

        const tags = await models.tag.findMany({
            where: { id: { in: tagIds } },
            include: { _count: { select: { notes: true } } }
        });

        return new Map(tags.map((tag) => [tag.id, tag._count.notes]));
    }
});

export const listNoteCleanupCandidates = noteCleanupService.listCleanupCandidates;
export const getNoteCleanupPreview = noteCleanupService.getDeletePreview;
export const deleteNoteById = noteCleanupService.deleteNoteById;
