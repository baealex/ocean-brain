export interface HybridSearchCandidate {
    noteId: number;
    lexicalRank: number | null;
    semanticRank: number | null;
    score: number;
}

interface HybridRankingInput {
    lexicalNoteIds: number[];
    semanticNoteIds: number[];
    lexicalWeight?: number;
    semanticWeight?: number;
    rankConstant?: number;
}

const DEFAULT_RANK_CONSTANT = 60;

const uniqueNoteIds = (noteIds: number[]) => {
    return [...new Set(noteIds.filter((noteId) => Number.isInteger(noteId) && noteId > 0))];
};

export const fuseHybridSearchRanks = ({
    lexicalNoteIds,
    semanticNoteIds,
    lexicalWeight = 1,
    semanticWeight = 1,
    rankConstant = DEFAULT_RANK_CONSTANT,
}: HybridRankingInput): HybridSearchCandidate[] => {
    const lexicalIds = uniqueNoteIds(lexicalNoteIds);
    const semanticIds = uniqueNoteIds(semanticNoteIds);
    const candidates = new Map<number, HybridSearchCandidate>();

    const addRankedIds = (noteIds: number[], source: 'lexical' | 'semantic', weight: number) => {
        noteIds.forEach((noteId, index) => {
            const rank = index + 1;
            const candidate = candidates.get(noteId) ?? {
                noteId,
                lexicalRank: null,
                semanticRank: null,
                score: 0,
            };

            candidate.score += weight / (rankConstant + rank);
            if (source === 'lexical') {
                candidate.lexicalRank = rank;
            } else {
                candidate.semanticRank = rank;
            }
            candidates.set(noteId, candidate);
        });
    };

    addRankedIds(lexicalIds, 'lexical', lexicalWeight);
    addRankedIds(semanticIds, 'semantic', semanticWeight);

    return [...candidates.values()].sort((left, right) => {
        if (left.score !== right.score) {
            return right.score - left.score;
        }

        const leftBestRank = Math.min(left.lexicalRank ?? Number.POSITIVE_INFINITY, left.semanticRank ?? Infinity);
        const rightBestRank = Math.min(right.lexicalRank ?? Number.POSITIVE_INFINITY, right.semanticRank ?? Infinity);
        if (leftBestRank !== rightBestRank) {
            return leftBestRank - rightBestRank;
        }

        if (left.lexicalRank !== null && right.lexicalRank === null) {
            return -1;
        }
        if (left.lexicalRank === null && right.lexicalRank !== null) {
            return 1;
        }

        return left.noteId - right.noteId;
    });
};
