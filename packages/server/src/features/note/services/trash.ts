import models, { type NoteLayout, type ReminderPriority } from '~/models.js';
import {
    createRetentionCutoff,
    RECOVERY_CLEANUP_BATCH_LIMIT,
    TRASH_RETENTION_DAYS,
} from '~/modules/recovery-retention.js';
import { buildNoteSearchProjection } from './search.js';

interface LiveTagRecord {
    id: number;
    name: string;
}

interface LiveReminderRecord {
    id: number;
    reminderDate: Date;
    completed: boolean;
    priority: ReminderPriority;
    content: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface LiveNoteRecord {
    id: number;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    pinned: boolean;
    order: number;
    layout: NoteLayout;
    tags: LiveTagRecord[];
    reminders: LiveReminderRecord[];
}

interface RestoredNoteRecord {
    id: number;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    pinned: boolean;
    order: number;
    layout: NoteLayout;
}

interface DeletedTagRecord {
    name: string;
}

interface DeletedReminderRecord {
    originalId: number | null;
    reminderDate: Date;
    completed: boolean;
    priority: ReminderPriority;
    content: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface DeletedNoteRecord {
    id: number;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    pinned: boolean;
    order: number;
    layout: NoteLayout;
    tags: DeletedTagRecord[];
    reminders: DeletedReminderRecord[];
}

interface BlockNoteNode {
    type: string;
    props?: Record<string, unknown>;
    content?: BlockNoteNode[];
    children?: BlockNoteNode[];
}

export interface TrashedNoteSummary {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
    pinned: boolean;
    order: number;
    layout: NoteLayout;
    tagNames: string[];
}

export interface TrashedNotesResult {
    totalCount: number;
    notes: TrashedNoteSummary[];
}

export class NoteRestoreConflictError extends Error {
    constructor(message = 'A live note with the same id already exists.') {
        super(message);
        this.name = 'NoteRestoreConflictError';
    }
}

interface NoteTrashServiceDeps {
    countDeletedNotes: () => Promise<number>;
    findDeletedNote: (id: number) => Promise<DeletedNoteRecord | null>;
    findLiveNote: (id: number) => Promise<LiveNoteRecord | null>;
    listDeletedNotes: (skip: number, take: number) => Promise<DeletedNoteRecord[]>;
    liveNoteExists: (id: number) => Promise<boolean>;
    moveNoteToTrash: (note: LiveNoteRecord) => Promise<DeletedNoteRecord>;
    purgeDeletedNote: (note: DeletedNoteRecord) => Promise<void>;
    purgeExpiredDeletedNotes: (before: Date, limit: number) => Promise<number>;
    restoreDeletedNote: (note: DeletedNoteRecord) => Promise<RestoredNoteRecord>;
}

const serializeTrashedNote = (note: DeletedNoteRecord): TrashedNoteSummary => ({
    id: String(note.id),
    title: note.title,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    deletedAt: note.deletedAt.toISOString(),
    pinned: note.pinned,
    order: note.order,
    layout: note.layout,
    tagNames: note.tags.map((tag) => tag.name),
});

const restoreTagIdsInContent = (content: string, tagIdByName: Map<string, number>) => {
    const rewriteNodes = (nodes: BlockNoteNode[]): BlockNoteNode[] => {
        return nodes.map((node) => ({
            ...node,
            content: node.content?.map((contentNode) => {
                if (contentNode.type !== 'tag') {
                    return contentNode;
                }

                const tagName = typeof contentNode.props?.tag === 'string' ? contentNode.props.tag : null;
                const restoredTagId = tagName ? tagIdByName.get(tagName) : null;

                if (!restoredTagId) {
                    return contentNode;
                }

                return {
                    ...contentNode,
                    props: {
                        ...contentNode.props,
                        id: String(restoredTagId),
                    },
                };
            }),
            children: node.children ? rewriteNodes(node.children) : node.children,
        }));
    };

    try {
        const parsed = JSON.parse(content) as BlockNoteNode[];
        return JSON.stringify(rewriteNodes(parsed));
    } catch {
        return content;
    }
};

export const createNoteTrashService = (deps: NoteTrashServiceDeps) => ({
    listTrashedNotes: async (input?: { limit?: number; offset?: number }): Promise<TrashedNotesResult> => {
        await deps.purgeExpiredDeletedNotes(createRetentionCutoff(TRASH_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);

        const limit = Math.max(1, Number(input?.limit ?? 25));
        const offset = Math.max(0, Number(input?.offset ?? 0));
        const [totalCount, notes] = await Promise.all([deps.countDeletedNotes(), deps.listDeletedNotes(offset, limit)]);

        return {
            totalCount,
            notes: notes.map(serializeTrashedNote),
        };
    },

    trashNoteById: async (id: number): Promise<TrashedNoteSummary | null> => {
        await deps.purgeExpiredDeletedNotes(createRetentionCutoff(TRASH_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);

        const note = await deps.findLiveNote(id);

        if (!note) {
            return null;
        }

        const trashedNote = await deps.moveNoteToTrash(note);
        return serializeTrashedNote(trashedNote);
    },

    restoreNoteById: async (id: number) => {
        await deps.purgeExpiredDeletedNotes(createRetentionCutoff(TRASH_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);

        const deletedNote = await deps.findDeletedNote(id);

        if (!deletedNote) {
            return null;
        }

        if (await deps.liveNoteExists(id)) {
            throw new NoteRestoreConflictError();
        }

        return deps.restoreDeletedNote(deletedNote);
    },

    purgeNoteById: async (id: number): Promise<TrashedNoteSummary | null> => {
        await deps.purgeExpiredDeletedNotes(createRetentionCutoff(TRASH_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);

        const deletedNote = await deps.findDeletedNote(id);

        if (!deletedNote) {
            return null;
        }

        const summary = serializeTrashedNote(deletedNote);
        await deps.purgeDeletedNote(deletedNote);
        return summary;
    },
});

const includeDeletedNote = {
    reminders: { orderBy: { reminderDate: 'asc' as const } },
    tags: { orderBy: { name: 'asc' as const } },
};

const defaultPurgeExpiredDeletedNotes = async (before: Date, limit: number) => {
    const expiredNotes = await models.deletedNote.findMany({
        where: { deletedAt: { lt: before } },
        orderBy: { deletedAt: 'asc' },
        take: limit,
        select: { id: true },
    });

    if (expiredNotes.length === 0) {
        return 0;
    }

    const deleted = await models.deletedNote.deleteMany({ where: { id: { in: expiredNotes.map((note) => note.id) } } });

    return deleted.count;
};

const noteTrashService = createNoteTrashService({
    countDeletedNotes: async () => models.deletedNote.count(),
    findDeletedNote: async (id) => {
        return models.deletedNote.findUnique({
            where: { id },
            include: includeDeletedNote,
        });
    },
    findLiveNote: async (id) => {
        return models.note.findUnique({
            where: { id },
            include: {
                reminders: { orderBy: { reminderDate: 'asc' } },
                tags: { orderBy: { name: 'asc' } },
            },
        });
    },
    listDeletedNotes: async (skip, take) => {
        return models.deletedNote.findMany({
            skip,
            take,
            orderBy: { deletedAt: 'desc' },
            include: includeDeletedNote,
        });
    },
    liveNoteExists: async (id) => {
        const note = await models.note.findUnique({
            where: { id },
            select: { id: true },
        });
        return Boolean(note);
    },
    purgeExpiredDeletedNotes: defaultPurgeExpiredDeletedNotes,
    purgeDeletedNote: async (deletedNote) => {
        await models.deletedNote.delete({ where: { id: deletedNote.id } });
    },
    moveNoteToTrash: async (note) => {
        return models.$transaction(async (tx) => {
            await tx.deletedNote.create({
                data: {
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    createdAt: note.createdAt,
                    updatedAt: note.updatedAt,
                    pinned: note.pinned,
                    order: note.order,
                    layout: note.layout,
                    tags: { create: note.tags.map((tag) => ({ name: tag.name })) },
                    reminders: {
                        create: note.reminders.map((reminder) => ({
                            originalId: reminder.id,
                            reminderDate: reminder.reminderDate,
                            completed: reminder.completed,
                            priority: reminder.priority,
                            content: reminder.content,
                            createdAt: reminder.createdAt,
                            updatedAt: reminder.updatedAt,
                        })),
                    },
                },
            });

            await tx.note.delete({ where: { id: note.id } });

            if (note.tags.length > 0) {
                await tx.tag.deleteMany({
                    where: {
                        id: { in: note.tags.map((tag) => tag.id) },
                        notes: { none: {} },
                    },
                });
            }

            return tx.deletedNote.findUniqueOrThrow({
                where: { id: note.id },
                include: includeDeletedNote,
            });
        });
    },
    restoreDeletedNote: async (deletedNote) => {
        return models.$transaction(async (tx) => {
            const tagNames = Array.from(new Set(deletedNote.tags.map((tag) => tag.name).filter(Boolean)));

            if (tagNames.length > 0) {
                const existingTags = await tx.tag.findMany({
                    where: { name: { in: tagNames } },
                    select: { name: true },
                });
                const existingTagNames = new Set(existingTags.map((tag) => tag.name));
                const missingTagNames = tagNames.filter((tagName) => !existingTagNames.has(tagName));

                for (const tagName of missingTagNames) {
                    await tx.tag.create({ data: { name: tagName } });
                }
            }

            const restoreTagIds =
                tagNames.length > 0
                    ? await tx.tag.findMany({
                          where: { name: { in: tagNames } },
                          select: {
                              id: true,
                              name: true,
                          },
                      })
                    : [];

            const restoredContent =
                restoreTagIds.length > 0
                    ? restoreTagIdsInContent(
                          deletedNote.content,
                          new Map(restoreTagIds.map((tag) => [tag.name, tag.id])),
                      )
                    : deletedNote.content;

            const note = await tx.note.create({
                data: {
                    id: deletedNote.id,
                    title: deletedNote.title,
                    content: restoredContent,
                    ...buildNoteSearchProjection({
                        title: deletedNote.title,
                        content: restoredContent,
                    }),
                    createdAt: deletedNote.createdAt,
                    updatedAt: deletedNote.updatedAt,
                    pinned: deletedNote.pinned,
                    order: deletedNote.order,
                    layout: deletedNote.layout,
                    ...(restoreTagIds.length > 0
                        ? { tags: { connect: restoreTagIds.map((tag) => ({ id: tag.id })) } }
                        : {}),
                    ...(deletedNote.reminders.length > 0
                        ? {
                              reminders: {
                                  create: deletedNote.reminders.map((reminder) => ({
                                      reminderDate: reminder.reminderDate,
                                      completed: reminder.completed,
                                      priority: reminder.priority,
                                      content: reminder.content,
                                      createdAt: reminder.createdAt,
                                      updatedAt: reminder.updatedAt,
                                  })),
                              },
                          }
                        : {}),
                },
            });

            await tx.deletedNote.delete({ where: { id: deletedNote.id } });

            return note;
        });
    },
});

export const listTrashedNotes = noteTrashService.listTrashedNotes;
export const trashNoteById = noteTrashService.trashNoteById;
export const restoreTrashedNoteById = noteTrashService.restoreNoteById;
export const purgeTrashedNoteById = noteTrashService.purgeNoteById;
export const purgeExpiredTrashedNotes = async () => {
    return defaultPurgeExpiredDeletedNotes(createRetentionCutoff(TRASH_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);
};
