import models, { type NoteLayout, Prisma } from '~/models.js';
import { buildNoteSearchProjection } from './search.js';
import { captureNoteBaseline } from './snapshot.js';
import { createNoteVersionConflictError, MissingNoteVersionError, parseNoteVersion } from './write-conflict.js';

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
    force?: boolean;
}

interface NoteWriteDeps {
    findNoteForWrite: (
        id: number,
    ) => Promise<Pick<NoteWriteRecord, 'title' | 'content' | 'updatedAt' | 'pinned' | 'order' | 'layout'> | null>;
    findNoteVersion: (id: number) => Promise<Pick<NoteWriteRecord, 'updatedAt'> | null>;
    captureBaseline: (input: {
        noteId: number;
        editSessionId?: string;
        meta?: string;
        baseline: Pick<NoteWriteRecord, 'id' | 'title' | 'content' | 'pinned' | 'order' | 'layout'>;
        force?: boolean;
    }) => Promise<unknown>;
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
        force = false,
    }: UpdateNoteWithVersionGuardInput): Promise<NoteWriteRecord | null> => {
        const existingNote = await deps.findNoteForWrite(id);

        if (!existingNote) {
            return null;
        }

        const expectedTimestamp = parseNoteVersion(expectedUpdatedAt);

        if (expectedTimestamp === null && !force) {
            throw new MissingNoteVersionError();
        }

        const nextTitle = data.title ?? existingNote.title;
        const nextContent = data.content ?? existingNote.content;
        const where = force
            ? { id }
            : { id, updatedAt: new Date(expectedTimestamp ?? existingNote.updatedAt.getTime()) };

        try {
            const updatedNote = await deps.updateNote({
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

            await deps.captureBaseline({
                noteId: id,
                baseline: {
                    id,
                    title: existingNote.title,
                    content: existingNote.content,
                    pinned: existingNote.pinned,
                    order: existingNote.order,
                    layout: existingNote.layout,
                },
                ...(editSessionId && !force ? { editSessionId } : {}),
                ...(snapshotMeta ? { meta: snapshotMeta } : {}),
                ...(force ? { force: true } : {}),
            });

            return updatedNote;
        } catch (error) {
            if (deps.isRecordNotFoundError(error)) {
                const currentNote = await deps.findNoteVersion(id);

                if (!currentNote) {
                    return null;
                }

                if (expectedTimestamp === null || currentNote.updatedAt.getTime() === expectedTimestamp) {
                    throw error;
                }

                throw createNoteVersionConflictError({
                    expectedUpdatedAt: expectedTimestamp,
                    currentUpdatedAt: currentNote.updatedAt.getTime(),
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
                pinned: true,
                order: true,
                layout: true,
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
