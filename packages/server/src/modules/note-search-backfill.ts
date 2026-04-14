import models from '~/models.js';
import {
    buildNoteSearchProjection,
    NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    type NoteSearchProjection,
} from './note-search.js';

interface BackfillCandidate {
    id: number;
    title: string;
    content: string;
}

interface NoteSearchBackfillDeps {
    listStaleNotes: (limit: number) => Promise<BackfillCandidate[]>;
    updateNotes: (updates: Array<{ id: number; projection: NoteSearchProjection }>) => Promise<void>;
}

const DEFAULT_BACKFILL_BATCH_SIZE = 100;
let activeNoteSearchBackfillPromise: Promise<number> | null = null;

const yieldToEventLoop = async () => {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
};

export const createNoteSearchBackfillService = (deps: NoteSearchBackfillDeps) => {
    const backfillBatch = async (limit = DEFAULT_BACKFILL_BATCH_SIZE) => {
        const staleNotes = await deps.listStaleNotes(limit);

        if (staleNotes.length === 0) {
            return 0;
        }

        await deps.updateNotes(
            staleNotes.map((note) => ({
                id: note.id,
                projection: buildNoteSearchProjection(note),
            })),
        );

        return staleNotes.length;
    };

    const backfillAll = async (limit = DEFAULT_BACKFILL_BATCH_SIZE) => {
        let total = 0;

        while (true) {
            const count = await backfillBatch(limit);

            if (!count) {
                return total;
            }

            total += count;

            if (count < limit) {
                return total;
            }

            await yieldToEventLoop();
        }
    };

    return {
        backfillBatch,
        backfillAll,
    };
};

const defaultNoteSearchBackfillService = createNoteSearchBackfillService({
    listStaleNotes: async (limit) => {
        return models.note.findMany({
            where: { searchableTextVersion: { not: NOTE_SEARCH_TEXT_SCHEMA_VERSION } },
            orderBy: { id: 'asc' },
            take: limit,
            select: {
                id: true,
                title: true,
                content: true,
            },
        });
    },
    updateNotes: async (updates) => {
        await models.$transaction(
            updates.map(({ id, projection }) =>
                models.note.update({
                    where: { id },
                    data: projection,
                }),
            ),
        );
    },
});

export const backfillStaleNoteSearchText = async (limit?: number) => {
    return defaultNoteSearchBackfillService.backfillAll(limit);
};

export const runNoteSearchBackfillInBackground = (limit?: number) => {
    if (activeNoteSearchBackfillPromise) {
        return activeNoteSearchBackfillPromise;
    }

    activeNoteSearchBackfillPromise = defaultNoteSearchBackfillService.backfillAll(limit).finally(() => {
        activeNoteSearchBackfillPromise = null;
    });

    return activeNoteSearchBackfillPromise;
};
