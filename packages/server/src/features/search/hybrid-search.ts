import {
    buildNoteSearchText,
    NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    type NoteSearchQuery,
    parseNoteSearchQuery,
} from '~/features/note/services/search.js';
import {
    resolvedWorkspaceScope,
    resolveWorkspaceWhere,
    WorkspaceError,
    type WorkspaceScopeInput,
} from '~/features/workspace/scope.js';
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

export interface LexicalCandidateMatch {
    noteId: number;
    /** Share of the query's search terms found in the note. */
    termCoverage: number;
}

interface HybridNoteSearchDependencies {
    listLexicalCandidates: (query: string, limit: number, workspaceId?: number) => Promise<LexicalCandidateMatch[]>;
    trySemanticSearch: (query: string, limit: number, eligibleNoteIds?: number[]) => Promise<SemanticSearchAttempt>;
    listEligibleNoteIds?: (workspaceId: number) => Promise<number[]>;
    findNotesByIds: (ids: number[], workspaceId?: number) => Promise<Note[]>;
}

interface HybridNoteSearchInput {
    scope?: WorkspaceScopeInput;
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
    resolvedScope?: ReturnType<typeof resolvedWorkspaceScope>;
    totalCount: number;
    notes: Note[];
    matches: SearchNoteMatch[];
    semanticAvailable: boolean;
    semanticUsed: boolean;
    semanticError: string | null;
}

const MAX_HYBRID_CANDIDATES = 80;
// The tail of a semantic result set is often made up of broadly related notes.
// Keep the larger lexical window for literal recall, but use only the strongest
// semantic matches when the two sources are fused.
const MAX_HYBRID_SEMANTIC_CANDIDATES = 30;
// A natural-language query shares at least one common word with most notes. Those weak keyword
// matches outnumber the meaning matches in rank fusion and push the closest note down, so hybrid
// ranking fuses only keyword candidates that contain at least half of the search terms. Without
// meaning matches, hybrid and keyword modes keep every partial keyword match.
const HYBRID_LEXICAL_MIN_TERM_COVERAGE = 0.5;

const unavailableSemanticAttempt = (error: unknown): SemanticSearchAttempt => ({
    available: false,
    used: false,
    matches: [],
    error: error instanceof Error ? error.message : 'Semantic search is unavailable.',
});

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

/** Share of the query's search terms found in the text. Queries with only excluded terms count as full coverage. */
export const getLexicalTermCoverage = (searchableText: string, query: string) => {
    const { included } = parseNoteSearchQuery(query);
    if (included.length === 0) {
        return 1;
    }

    const normalizedSearchableText = searchableText.toLowerCase();
    return included.filter((term) => normalizedSearchableText.includes(term)).length / included.length;
};

export const matchesHybridLexicalQuery = (searchableText: string, query: string) => {
    const parsedQuery = parseNoteSearchQuery(query);
    const normalizedSearchableText = searchableText.toLowerCase();
    const includesAnyTerm =
        parsedQuery.included.length === 0 ||
        parsedQuery.included.some((term) => normalizedSearchableText.includes(term));

    return includesAnyTerm && parsedQuery.excluded.every((term) => !normalizedSearchableText.includes(term));
};

const scoreLexicalCandidate = (candidate: LexicalCandidate, parsedQuery: NoteSearchQuery) => {
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
    // Score each candidate once. Scoring inside the comparator lowercases every note body on each comparison.
    const parsedQuery = parseNoteSearchQuery(query);
    return candidates
        .map((candidate) => ({ candidate, score: scoreLexicalCandidate(candidate, parsedQuery) }))
        .sort((left, right) => {
            if (left.score !== right.score) {
                return right.score - left.score;
            }

            const updatedAtDifference = right.candidate.updatedAt.getTime() - left.candidate.updatedAt.getTime();
            return updatedAtDifference !== 0 ? updatedAtDifference : left.candidate.id - right.candidate.id;
        })
        .map(({ candidate }) => candidate);
};

const listDefaultLexicalCandidates = async (
    query: string,
    limit: number,
    workspaceId?: number,
): Promise<LexicalCandidateMatch[]> => {
    const where = buildLexicalWhere(query);
    if (!where) {
        return [];
    }

    const [freshCandidates, staleCandidates] = await Promise.all([
        models.note.findMany({
            where: { ...where, ...(workspaceId === undefined ? {} : { workspaceId }) },
            select: {
                id: true,
                title: true,
                searchableText: true,
                updatedAt: true,
            },
        }),
        models.note.findMany({
            where: {
                searchableTextVersion: { not: NOTE_SEARCH_TEXT_SCHEMA_VERSION },
                ...(workspaceId === undefined ? {} : { workspaceId }),
            },
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
        .map((candidate) => ({
            noteId: candidate.id,
            termCoverage: getLexicalTermCoverage(candidate.searchableText, query),
        }));
};

const defaultDependencies: HybridNoteSearchDependencies = {
    listLexicalCandidates: listDefaultLexicalCandidates,
    trySemanticSearch: (query, limit, eligibleNoteIds) =>
        getDefaultSemanticSearchManager().trySearch(query, limit, eligibleNoteIds),
    listEligibleNoteIds: async (workspaceId) =>
        (await models.note.findMany({ where: { workspaceId }, select: { id: true } })).map((note) => note.id),
    findNotesByIds: (ids, workspaceId) =>
        models.note.findMany({ where: { id: { in: ids }, ...(workspaceId === undefined ? {} : { workspaceId }) } }),
};

export const createHybridNoteSearch = (dependencies: HybridNoteSearchDependencies = defaultDependencies) => {
    return async ({
        query,
        limit,
        offset,
        mode = 'hybrid',
        scope,
    }: HybridNoteSearchInput): Promise<HybridNoteSearchResult> => {
        const workspaceWhere = await resolveWorkspaceWhere(scope);
        const workspaceId = workspaceWhere.workspaceId;
        if (workspaceId !== undefined && !dependencies.listEligibleNoteIds)
            throw new WorkspaceError(
                'UNSUPPORTED_WORKSPACE_SCOPE',
                'This search provider does not support workspace scopes.',
            );
        const eligibleNoteIds =
            workspaceId === undefined ? undefined : await dependencies.listEligibleNoteIds?.(workspaceId);
        const normalizedQuery = query.trim();
        if (!normalizedQuery || limit <= 0 || offset < 0) {
            return {
                resolvedScope: resolvedWorkspaceScope(workspaceWhere),
                totalCount: 0,
                notes: [],
                matches: [],
                semanticAvailable: false,
                semanticUsed: false,
                semanticError: null,
            };
        }

        const candidateLimit = MAX_HYBRID_CANDIDATES;
        const semanticCandidateLimit = mode === 'hybrid' ? MAX_HYBRID_SEMANTIC_CANDIDATES : MAX_HYBRID_CANDIDATES;
        const [lexicalCandidates, semanticAttempt] = await Promise.all([
            mode === 'semantic'
                ? Promise.resolve([])
                : workspaceId === undefined
                  ? dependencies.listLexicalCandidates(normalizedQuery, candidateLimit)
                  : dependencies.listLexicalCandidates(normalizedQuery, candidateLimit, workspaceId),
            mode === 'lexical'
                ? Promise.resolve({
                      available: false,
                      used: false,
                      matches: [],
                      error: null,
                  } satisfies SemanticSearchAttempt)
                : dependencies
                      .trySemanticSearch(normalizedQuery, semanticCandidateLimit, eligibleNoteIds)
                      .catch((error) => unavailableSemanticAttempt(error)),
        ]);
        const semanticNoteIds = semanticAttempt.matches.slice(0, semanticCandidateLimit).map((match) => match.noteId);
        const filtersWeakLexicalMatches = mode === 'hybrid' && semanticNoteIds.length > 0;
        const lexicalNoteIds = lexicalCandidates
            .filter(
                (candidate) => !filtersWeakLexicalMatches || candidate.termCoverage >= HYBRID_LEXICAL_MIN_TERM_COVERAGE,
            )
            .map((candidate) => candidate.noteId);
        const rankedCandidates = fuseHybridSearchRanks({ lexicalNoteIds, semanticNoteIds });
        const pageCandidates = rankedCandidates.slice(offset, offset + limit);
        const ids = pageCandidates.map((candidate) => candidate.noteId);
        const notes =
            workspaceId === undefined
                ? await dependencies.findNotesByIds(ids)
                : await dependencies.findNotesByIds(ids, workspaceId);
        const notesById = new Map(notes.map((note) => [note.id, note]));
        const existingCandidates = pageCandidates.filter((candidate) => notesById.has(candidate.noteId));

        return {
            resolvedScope: resolvedWorkspaceScope(workspaceWhere),
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
