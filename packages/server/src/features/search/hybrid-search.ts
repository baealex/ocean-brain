import {
    buildNoteSearchText,
    NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    parseNoteSearchQuery,
} from '~/features/note/services/search.js';
import type { Note, Prisma } from '~/models.js';
import models from '~/models.js';
import { runDataMaintenanceInBackground } from '~/modules/data-maintenance.js';
import { fuseHybridSearchRanks } from './hybrid-ranking.js';
import { getDefaultSemanticSearchManager, type SemanticSearchAttempt } from './search-manager.js';

interface LexicalCandidate {
    id: number;
    title: string;
    searchableText: string;
    updatedAt: Date;
}

interface StaleLexicalCandidate extends LexicalCandidate {
    content: string;
}

interface HybridNoteSearchDependencies {
    listLexicalNoteIds: (query: string, limit: number) => Promise<number[]>;
    trySemanticSearch: (query: string, limit: number) => Promise<SemanticSearchAttempt>;
    findNotesByIds: (ids: number[]) => Promise<Note[]>;
}

interface HybridNoteSearchInput {
    query: string;
    limit: number;
    offset: number;
    mode?: SearchMode;
}

export type SearchMode = 'hybrid' | 'lexical' | 'semantic';

export interface SearchNoteMatch {
    noteId: number;
    lexical: boolean;
    semantic: boolean;
}

export interface HybridNoteSearchResult {
    totalCount: number;
    notes: Note[];
    matches: SearchNoteMatch[];
    semanticAvailable: boolean;
    semanticUsed: boolean;
    semanticError: string | null;
}

const MAX_HYBRID_CANDIDATES = 80;

const buildLexicalWhere = (query: string): Prisma.NoteWhereInput | undefined => {
    const parsedQuery = parseNoteSearchQuery(query);
    if (!parsedQuery.hasFilters) {
        return undefined;
    }

    return {
        AND: [
            { searchableTextVersion: NOTE_SEARCH_TEXT_SCHEMA_VERSION },
            ...(parsedQuery.included.length > 0
                ? [
                      {
                          OR: parsedQuery.included.map((term) => ({ searchableText: { contains: term } })),
                      },
                  ]
                : []),
            ...parsedQuery.excluded.map((term) => ({ NOT: { searchableText: { contains: term } } })),
        ],
    };
};

export const matchesHybridLexicalQuery = (searchableText: string, query: string) => {
    const parsedQuery = parseNoteSearchQuery(query);
    const normalizedSearchableText = searchableText.toLowerCase();
    const includesAnyTerm =
        parsedQuery.included.length === 0 ||
        parsedQuery.included.some((term) => normalizedSearchableText.includes(term));

    return includesAnyTerm && parsedQuery.excluded.every((term) => !normalizedSearchableText.includes(term));
};

const scoreLexicalCandidate = (candidate: LexicalCandidate, query: string) => {
    const parsedQuery = parseNoteSearchQuery(query);
    const phrase = parsedQuery.included.join(' ');
    const title = candidate.title.toLowerCase();
    const searchableText = candidate.searchableText.toLowerCase();
    const matchingTermCount = parsedQuery.included.filter((term) => searchableText.includes(term)).length;
    let score = 0;

    if (phrase && title === phrase) {
        score += 100;
    } else if (phrase && title.includes(phrase)) {
        score += 40;
    }

    if (phrase && searchableText.includes(phrase)) {
        score += 15;
    }

    if (parsedQuery.included.length > 1 && matchingTermCount === parsedQuery.included.length) {
        score += 20;
    }

    for (const term of parsedQuery.included) {
        if (title.includes(term)) {
            score += 8;
        }
        if (searchableText.includes(term)) {
            score += 1;
        }
    }

    return score;
};

export const rankLexicalCandidates = (candidates: LexicalCandidate[], query: string) => {
    return [...candidates].sort((left, right) => {
        const scoreDifference = scoreLexicalCandidate(right, query) - scoreLexicalCandidate(left, query);
        if (scoreDifference !== 0) {
            return scoreDifference;
        }

        const updatedAtDifference = right.updatedAt.getTime() - left.updatedAt.getTime();
        return updatedAtDifference !== 0 ? updatedAtDifference : left.id - right.id;
    });
};

const listDefaultLexicalNoteIds = async (query: string, limit: number) => {
    const where = buildLexicalWhere(query);
    if (!where) {
        return [];
    }

    const [freshCandidates, staleCandidates] = await Promise.all([
        models.note.findMany({
            where,
            select: {
                id: true,
                title: true,
                searchableText: true,
                updatedAt: true,
            },
        }),
        models.note.findMany({
            where: { searchableTextVersion: { not: NOTE_SEARCH_TEXT_SCHEMA_VERSION } },
            select: {
                id: true,
                title: true,
                content: true,
                searchableText: true,
                updatedAt: true,
            },
        }),
    ]);

    if (staleCandidates.length > 0) {
        void runDataMaintenanceInBackground();
    }

    const matchingStaleCandidates = (staleCandidates as StaleLexicalCandidate[])
        .map((candidate) => ({
            ...candidate,
            searchableText: buildNoteSearchText(candidate),
        }))
        .filter((candidate) => matchesHybridLexicalQuery(candidate.searchableText, query));

    return rankLexicalCandidates([...freshCandidates, ...matchingStaleCandidates], query)
        .slice(0, limit)
        .map((candidate) => candidate.id);
};

const defaultDependencies: HybridNoteSearchDependencies = {
    listLexicalNoteIds: listDefaultLexicalNoteIds,
    trySemanticSearch: (query, limit) => getDefaultSemanticSearchManager().trySearch(query, limit),
    findNotesByIds: (ids) => models.note.findMany({ where: { id: { in: ids } } }),
};

export const createHybridNoteSearch = (dependencies: HybridNoteSearchDependencies = defaultDependencies) => {
    return async ({
        query,
        limit,
        offset,
        mode = 'hybrid',
    }: HybridNoteSearchInput): Promise<HybridNoteSearchResult> => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery || limit <= 0 || offset < 0) {
            return {
                totalCount: 0,
                notes: [],
                matches: [],
                semanticAvailable: false,
                semanticUsed: false,
                semanticError: null,
            };
        }

        const candidateLimit = Math.min(MAX_HYBRID_CANDIDATES, Math.max(40, offset + limit));
        const [lexicalNoteIds, semanticAttempt] = await Promise.all([
            mode === 'semantic'
                ? Promise.resolve([])
                : dependencies.listLexicalNoteIds(normalizedQuery, candidateLimit),
            mode === 'lexical'
                ? Promise.resolve({
                      available: false,
                      used: false,
                      matches: [],
                      error: null,
                  } satisfies SemanticSearchAttempt)
                : dependencies.trySemanticSearch(normalizedQuery, candidateLimit),
        ]);
        const rankedCandidates = fuseHybridSearchRanks({
            lexicalNoteIds,
            semanticNoteIds: semanticAttempt.matches.map((match) => match.noteId),
        });
        const pageCandidates = rankedCandidates.slice(offset, offset + limit);
        const notes = await dependencies.findNotesByIds(pageCandidates.map((candidate) => candidate.noteId));
        const notesById = new Map(notes.map((note) => [note.id, note]));
        const existingCandidates = pageCandidates.filter((candidate) => notesById.has(candidate.noteId));

        return {
            totalCount: rankedCandidates.length,
            notes: existingCandidates.map((candidate) => notesById.get(candidate.noteId) as Note),
            matches: existingCandidates.map((candidate) => ({
                noteId: candidate.noteId,
                lexical: candidate.lexicalRank !== null,
                semantic: candidate.semanticRank !== null,
            })),
            semanticAvailable: semanticAttempt.available,
            semanticUsed: semanticAttempt.used,
            semanticError: semanticAttempt.error,
        };
    };
};

export const searchNotesHybrid = createHybridNoteSearch();
