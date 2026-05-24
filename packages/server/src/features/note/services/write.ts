import models, { type NoteLayout, Prisma } from '~/models.js';
import { buildNoteSearchProjection } from './search.js';
import { captureNoteBaseline } from './snapshot.js';
import { createNoteVersionConflictError, parseNoteVersion } from './write-conflict.js';

interface NoteWriteRecord {
    id: number;
    title: string;
    content: string;
    layout: NoteLayout;
    createdAt: Date;
    updatedAt: Date;
    pinned: boolean;
    order: number;
}

type NoteWriteData = {
    title?: string;
    content?: string;
    layout?: NoteLayout;
    tagIds?: number[];
};

interface UpdateNoteWithVersionGuardInput {
    id: number;
    data: NoteWriteData;
    editSessionId?: string;
    expectedUpdatedAt?: string;
    snapshotMeta?: string;
}

interface NoteWriteDeps {
    findNoteForWrite: (id: number) => Promise<Pick<NoteWriteRecord, 'title' | 'content' | 'updatedAt'> | null>;
    findNoteVersion: (id: number) => Promise<Pick<NoteWriteRecord, 'updatedAt'> | null>;
    captureBaseline: (input: { noteId: number; editSessionId?: string; meta?: string }) => Promise<unknown>;
    updateNote: (input: {
        where: {
            id: number;
            updatedAt?: Date;
        };
        data: {
            title?: string;
            content?: string;
            layout?: NoteLayout;
            searchableText: string;
            searchableTextVersion: number;
            tags?: {
                set: Array<{ id: number }>;
            };
        };
    }) => Promise<NoteWriteRecord>;
    isRecordNotFoundError: (error: unknown) => boolean;
}

const isRecordNotFoundError = (error: unknown) => {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
};

export const createNoteWriteService = (deps: NoteWriteDeps) => ({
    updateNoteWithVersionGuard: async ({
        id,
        data,
        editSessionId,
        expectedUpdatedAt,
        snapshotMeta,
    }: UpdateNoteWithVersionGuardInput): Promise<NoteWriteRecord | null> => {
        const existingNote = await deps.findNoteForWrite(id);

        if (!existingNote) {
            return null;
        }

        const expectedTimestamp = parseNoteVersion(expectedUpdatedAt);

        await deps.captureBaseline({
            noteId: id,
            ...(editSessionId ? { editSessionId } : {}),
            ...(snapshotMeta ? { meta: snapshotMeta } : {}),
        });

        const nextTitle = data.title ?? existingNote.title;
        const nextContent = data.content ?? existingNote.content;
        const where = expectedTimestamp === null ? { id } : { id, updatedAt: new Date(expectedTimestamp) };

        try {
            return await deps.updateNote({
                where,
                data: {
                    ...(data.title !== undefined ? { title: data.title } : {}),
                    ...(data.content !== undefined ? { content: data.content } : {}),
                    ...(data.layout !== undefined ? { layout: data.layout } : {}),
                    ...buildNoteSearchProjection({
                        title: nextTitle,
                        content: nextContent,
                    }),
                    ...(data.tagIds ? { tags: { set: data.tagIds.map((tagId) => ({ id: tagId })) } } : {}),
                },
            });
        } catch (error) {
            if (expectedTimestamp !== null && deps.isRecordNotFoundError(error)) {
                const currentNote = await deps.findNoteVersion(id);

                throw createNoteVersionConflictError({
                    expectedUpdatedAt: expectedTimestamp,
                    currentUpdatedAt: currentNote?.updatedAt.getTime() ?? existingNote.updatedAt.getTime(),
                });
            }

            throw error;
        }
    },
});

const defaultNoteWriteService = createNoteWriteService({
    findNoteForWrite: (id) =>
        models.note.findUnique({
            where: { id },
            select: {
                title: true,
                content: true,
                updatedAt: true,
            },
        }),
    findNoteVersion: (id) =>
        models.note.findUnique({
            where: { id },
            select: {
                updatedAt: true,
            },
        }),
    captureBaseline: captureNoteBaseline,
    updateNote: ({ where, data }) =>
        models.note.update({
            where,
            data,
        }),
    isRecordNotFoundError,
});

export const updateNoteWithVersionGuard = async (input: UpdateNoteWithVersionGuardInput) => {
    return defaultNoteWriteService.updateNoteWithVersionGuard(input);
};
