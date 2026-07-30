import models, { type Prisma } from '~/models.js';
import { extractReferenceBlocksFromContent, normalizeReferenceId } from './content-blocks.js';

export const NOTE_REFERENCE_INDEX_VERSION = 1;
export const NOTE_REFERENCE_INDEX_STATE_ID = 1;

const SQLITE_MAX_INT_ID = 2_147_483_647;
const REFERENCE_INDEX_REBUILD_BATCH_SIZE = 250;

type NoteReferenceWriteClient = Pick<Prisma.TransactionClient, 'noteReference'>;

const toNoteId = (value: unknown) => {
    const normalized = normalizeReferenceId(value);

    if (!normalized || !/^[1-9]\d*$/.test(normalized)) {
        return null;
    }

    const id = Number(normalized);

    return Number.isSafeInteger(id) && id <= SQLITE_MAX_INT_ID ? id : null;
};

export const extractNoteReferenceIds = (content: string) => {
    return Array.from(
        new Set(
            extractReferenceBlocksFromContent(content)
                .map((block) => toNoteId(block.props?.id))
                .filter((id): id is number => id !== null),
        ),
    );
};

export const replaceNoteReferences = async (db: NoteReferenceWriteClient, sourceNoteId: number, content: string) => {
    const targetIds = extractNoteReferenceIds(content).filter((targetNoteId) => targetNoteId !== sourceNoteId);

    await db.noteReference.deleteMany({ where: { sourceNoteId } });

    if (targetIds.length === 0) {
        return 0;
    }

    const references = targetIds.map((targetNoteId) => ({ sourceNoteId, targetNoteId }));

    if (references.length > 0) {
        await db.noteReference.createMany({ data: references });
    }

    return references.length;
};

const rebuildNoteReferenceIndex = async () => {
    await models.noteReference.deleteMany();

    let cursor = 0;
    let processedCount = 0;

    while (true) {
        const notes = await models.note.findMany({
            where: { id: { gt: cursor } },
            orderBy: { id: 'asc' },
            take: REFERENCE_INDEX_REBUILD_BATCH_SIZE,
            select: {
                id: true,
                content: true,
            },
        });

        if (notes.length === 0) {
            break;
        }

        const references = notes.flatMap((note) =>
            extractNoteReferenceIds(note.content)
                .filter((targetNoteId) => targetNoteId !== note.id)
                .map((targetNoteId) => ({
                    sourceNoteId: note.id,
                    targetNoteId,
                })),
        );

        if (references.length > 0) {
            await models.noteReference.createMany({ data: references });
            processedCount += references.length;
        }

        cursor = notes[notes.length - 1].id;
    }

    await models.noteReferenceIndexState.upsert({
        where: { id: NOTE_REFERENCE_INDEX_STATE_ID },
        create: {
            id: NOTE_REFERENCE_INDEX_STATE_ID,
            version: NOTE_REFERENCE_INDEX_VERSION,
            updatedAt: new Date(),
        },
        update: {
            version: NOTE_REFERENCE_INDEX_VERSION,
        },
    });

    return processedCount;
};

let activeRebuild: Promise<number> | null = null;

export const ensureNoteReferenceIndex = async () => {
    const state = await models.noteReferenceIndexState.findUnique({
        where: { id: NOTE_REFERENCE_INDEX_STATE_ID },
        select: { version: true },
    });

    if (state?.version === NOTE_REFERENCE_INDEX_VERSION) {
        return 0;
    }

    if (!activeRebuild) {
        activeRebuild = rebuildNoteReferenceIndex().finally(() => {
            activeRebuild = null;
        });
    }

    return activeRebuild;
};
