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
}

export interface HybridNoteSearchResult {
    totalCount: number;
    notes: Note[];
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
            ...parsedQuery.included.map((term) => ({ searchableText: { contains: term } })),
            ...parsedQuery.excluded.map((term) => ({ NOT: { searchableText: { contains: term } } })),
        ],
    };
};

const scoreLexicalCandidate = (candidate: LexicalCandidate, query: string) => {
    const parsedQuery = parseNoteSearchQuery(query);
    const phrase = parsedQuery.included.join(' ');
    const title = candidate.title.toLowerCase();
    const searchableText = candidate.searchableText.toLowerCase();
    let score = 0;

    if (phrase && title === phrase) {
        score += 100;
    } else if (phrase && title.includes(phrase)) {
        score += 40;
    }

    if (phrase && searchableText.includes(phrase)) {
        score += 15;
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

    const parsedQuery = parseNoteSearchQuery(query);
    const matchingStaleCandidates = (staleCandidates as StaleLexicalCandidate[])
        .map((candidate) => ({
            ...candidate,
            searchableText: buildNoteSearchText(candidate),
        }))
        .filter(
            (candidate) =>
                parsedQuery.included.every((term) => candidate.searchableText.includes(term)) &&
                parsedQuery.excluded.every((term) => !candidate.searchableText.includes(term)),
        );

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
    return async ({ query, limit, offset }: HybridNoteSearchInput): Promise<HybridNoteSearchResult> => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery || limit <= 0 || offset < 0) {
            return {
                totalCount: 0,
                notes: [],
                semanticAvailable: false,
                semanticUsed: false,
                semanticError: null,
            };
        }

        const candidateLimit = Math.min(MAX_HYBRID_CANDIDATES, Math.max(40, offset + limit));
        const [lexicalNoteIds, semanticAttempt] = await Promise.all([
            dependencies.listLexicalNoteIds(normalizedQuery, candidateLimit),
            dependencies.trySemanticSearch(normalizedQuery, candidateLimit),
        ]);
        const rankedCandidates = fuseHybridSearchRanks({
            lexicalNoteIds,
            semanticNoteIds: semanticAttempt.matches.map((match) => match.noteId),
        });
        const pageCandidates = rankedCandidates.slice(offset, offset + limit);
        const notes = await dependencies.findNotesByIds(pageCandidates.map((candidate) => candidate.noteId));
        const notesById = new Map(notes.map((note) => [note.id, note]));

        return {
            totalCount: rankedCandidates.length,
            notes: pageCandidates
                .map((candidate) => notesById.get(candidate.noteId))
                .filter((note): note is Note => Boolean(note)),
            semanticAvailable: semanticAttempt.available,
            semanticUsed: semanticAttempt.used,
            semanticError: semanticAttempt.error,
        };
    };
};

export const searchNotesHybrid = createHybridNoteSearch();
