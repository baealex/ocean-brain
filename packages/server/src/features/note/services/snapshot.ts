import { ensureTagByName } from '~/features/tag/services/organization.js';
import models, { type NoteLayout } from '~/models.js';
import { blocksToMarkdown, extractTagIdsFromContentJson } from '~/modules/blocknote.js';
import { type BlockNoteTreeNode, parseBlockNoteContent, walkBlockNoteTree } from '~/modules/blocknote-tree.js';
import {
    createRetentionCutoff,
    RECOVERY_CLEANUP_BATCH_LIMIT,
    SNAPSHOT_MAX_PER_NOTE,
    SNAPSHOT_RETENTION_DAYS,
} from '~/modules/recovery-retention.js';
import { buildNoteSearchProjection, extractVisibleSearchTextFromContent } from './search.js';

const SNAPSHOT_CONTENT_PREVIEW_MAX_LENGTH = 240;

interface NoteRecord {
    id: number;
    title: string;
    content: string;
    pinned: boolean;
    order: number;
    layout: NoteLayout;
    updatedAt?: Date;
}

interface NoteSnapshotRecord {
    id: number;
    noteId: number;
    title: string;
    payload: string;
    editSessionId: string | null;
    meta: string | null;
    createdAt: Date;
}

interface NoteSnapshotDeps {
    findNoteById: (id: number) => Promise<NoteRecord | null>;
    findSnapshotByEditSessionId: (noteId: number, editSessionId: string) => Promise<NoteSnapshotRecord | null>;
    findLatestSnapshot: (noteId: number) => Promise<NoteSnapshotRecord | null>;
    createSnapshot: (input: {
        noteId: number;
        title: string;
        payload: string;
        editSessionId?: string;
        meta?: string;
    }) => Promise<NoteSnapshotRecord>;
    listSnapshots: (noteId: number, limit: number) => Promise<NoteSnapshotRecord[]>;
    findSnapshotById: (id: number) => Promise<NoteSnapshotRecord | null>;
    purgeExpiredSnapshots: (before: Date, limit: number) => Promise<number>;
    trimOverflowSnapshots: (noteId: number, keep: number, limit: number) => Promise<number>;
    resolveRestoredTags?: (content: string) => Promise<ResolvedRestoredSnapshotTags | null>;
    updateNote: (
        id: number,
        input: {
            title: string;
            content: string;
            pinned: boolean;
            order: number;
            layout: NoteLayout;
            tagIds?: number[];
        },
    ) => Promise<NoteRecord>;
}

export interface NoteSnapshotMeta {
    entrypoint?: 'web' | 'mobile' | 'mcp';
    label?: string;
}

interface NoteSnapshotPayload {
    title: string;
    content: string;
    pinned: boolean;
    order: number;
    layout: NoteLayout;
}

interface TagRecord {
    id: number;
    name: string;
}

interface ResolvedRestoredSnapshotTags {
    content: string;
    tagIds: number[];
}

interface ResolveRestoredSnapshotTagsDeps {
    ensureTagByName: (name: string) => Promise<TagRecord>;
    findTagsByIds: (ids: number[]) => Promise<TagRecord[]>;
}

export interface NoteSnapshotSummary {
    id: string;
    title: string;
    createdAt: string;
    meta: NoteSnapshotMeta;
    contentPreview: string;
    contentAsMarkdown?: string;
    payload?: string;
}

const parseMeta = (value?: string | null): NoteSnapshotMeta => {
    if (!value) {
        return {};
    }

    try {
        const parsed = JSON.parse(value) as NoteSnapshotMeta;
        return {
            ...(parsed.entrypoint ? { entrypoint: parsed.entrypoint } : {}),
            ...(parsed.label ? { label: parsed.label } : {}),
        };
    } catch {
        return {};
    }
};

const readSnapshotContent = (payload: string) => {
    try {
        return parsePayload(payload).content;
    } catch {
        return '';
    }
};

const buildSnapshotContentPreview = (content: string) => {
    const preview = extractVisibleSearchTextFromContent(content);

    if (preview.length <= SNAPSHOT_CONTENT_PREVIEW_MAX_LENGTH) {
        return preview;
    }

    return `${preview.slice(0, SNAPSHOT_CONTENT_PREVIEW_MAX_LENGTH).trimEnd()}...`;
};

const serializeSnapshot = (snapshot: NoteSnapshotRecord): NoteSnapshotSummary => ({
    id: String(snapshot.id),
    title: snapshot.title,
    contentPreview: buildSnapshotContentPreview(readSnapshotContent(snapshot.payload)),
    createdAt: snapshot.createdAt.toISOString(),
    meta: parseMeta(snapshot.meta),
    payload: snapshot.payload,
});

const serializePayload = (note: NoteRecord): string => {
    const payload: NoteSnapshotPayload = {
        title: note.title,
        content: note.content,
        pinned: note.pinned,
        order: note.order,
        layout: note.layout,
    };

    return JSON.stringify(payload);
};

const hasSameSnapshotPayload = (snapshot: NoteSnapshotRecord | null, payload: string) => {
    return snapshot?.payload === payload;
};

const parsePayload = (payload: string): NoteSnapshotPayload => {
    const parsed = JSON.parse(payload) as Partial<NoteSnapshotPayload>;

    if (
        typeof parsed.title !== 'string' ||
        typeof parsed.content !== 'string' ||
        typeof parsed.pinned !== 'boolean' ||
        typeof parsed.order !== 'number' ||
        (parsed.layout !== 'narrow' && parsed.layout !== 'wide' && parsed.layout !== 'full')
    ) {
        throw new Error('INVALID_NOTE_SNAPSHOT_PAYLOAD');
    }

    return parsed as NoteSnapshotPayload;
};

const extractRestoredTagIds = (content: string): number[] | null => {
    try {
        return extractTagIdsFromContentJson(content)
            .map(normalizeRestoredTagId)
            .filter((id): id is number => id !== null);
    } catch {
        return null;
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const normalizeRestoredTagId = (value: unknown) => {
    if (value === undefined || value === null) {
        return null;
    }

    const normalized = typeof value === 'string' ? value.trim() : value;

    if (normalized === '') {
        return null;
    }

    const numericId = Number(normalized);
    return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
};

const normalizeRestoredTagName = (value: unknown) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
};

export const resolveRestoredSnapshotTags = async (
    content: string,
    deps: ResolveRestoredSnapshotTagsDeps,
): Promise<ResolvedRestoredSnapshotTags | null> => {
    const parsed = parseBlockNoteContent(content);

    if (!parsed) {
        return null;
    }

    const tagRefs: Array<{
        id: number | null;
        name: string | null;
        node: BlockNoteTreeNode;
        props: Record<string, unknown>;
    }> = [];

    walkBlockNoteTree(parsed, (node) => {
        if (node.type !== 'tag' || !isRecord(node.props)) {
            return;
        }

        tagRefs.push({
            id: normalizeRestoredTagId(node.props.id),
            name: normalizeRestoredTagName(node.props.tag),
            node,
            props: node.props,
        });
    });

    if (tagRefs.length === 0) {
        return { content, tagIds: [] };
    }

    const candidateIds = Array.from(new Set(tagRefs.map((tag) => tag.id).filter((id): id is number => id !== null)));
    const existingTags = candidateIds.length > 0 ? await deps.findTagsByIds(candidateIds) : [];
    const existingTagIds = new Set(existingTags.map((tag) => tag.id));
    const tagIds = new Set<number>();
    let contentChanged = false;

    for (const tagRef of tagRefs) {
        if (tagRef.id !== null && existingTagIds.has(tagRef.id)) {
            tagIds.add(tagRef.id);
            continue;
        }

        if (!tagRef.name) {
            continue;
        }

        try {
            const resolvedTag = await deps.ensureTagByName(tagRef.name);
            tagRef.node.props = {
                ...tagRef.props,
                id: String(resolvedTag.id),
                tag: resolvedTag.name,
            };
            tagIds.add(resolvedTag.id);
            contentChanged = true;
        } catch {
            continue;
        }
    }

    return {
        content: contentChanged ? JSON.stringify(parsed) : content,
        tagIds: [...tagIds],
    };
};

export const renderNoteSnapshotContentAsMarkdown = async (payload: string) => {
    try {
        const snapshotPayload = parsePayload(payload);
        return blocksToMarkdown(snapshotPayload.content);
    } catch {
        return '';
    }
};

const serializeSnapshotWithContent = async (snapshot: NoteSnapshotRecord): Promise<NoteSnapshotSummary> => {
    const contentAsMarkdown = await renderNoteSnapshotContentAsMarkdown(snapshot.payload);

    return {
        ...serializeSnapshot(snapshot),
        contentAsMarkdown,
    };
};

export const createSnapshotMetaFromUserAgent = (userAgent?: string | null): string | undefined => {
    const normalized = userAgent?.toLowerCase() ?? '';
    const isMobile = /iphone|ipad|android|mobile/.test(normalized);

    return JSON.stringify({
        entrypoint: isMobile ? 'mobile' : 'web',
        label: isMobile ? 'Mobile browser' : 'Web browser',
    } satisfies NoteSnapshotMeta);
};

export const MCP_SNAPSHOT_META = JSON.stringify({
    entrypoint: 'mcp',
    label: 'MCP',
} satisfies NoteSnapshotMeta);

const defaultPurgeExpiredSnapshots = async (before: Date, limit: number) => {
    const expiredSnapshots = await models.noteSnapshot.findMany({
        where: { createdAt: { lt: before } },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { id: true },
    });

    if (expiredSnapshots.length === 0) {
        return 0;
    }

    const deleted = await models.noteSnapshot.deleteMany({
        where: { id: { in: expiredSnapshots.map((snapshot) => snapshot.id) } },
    });

    return deleted.count;
};

const defaultTrimOverflowSnapshots = async (noteId: number, keep: number, limit: number) => {
    const overflowSnapshots = await models.noteSnapshot.findMany({
        where: { noteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: keep,
        take: limit,
        select: { id: true },
    });

    if (overflowSnapshots.length === 0) {
        return 0;
    }

    const deleted = await models.noteSnapshot.deleteMany({
        where: { id: { in: overflowSnapshots.map((snapshot) => snapshot.id) } },
    });

    return deleted.count;
};

export const createNoteSnapshotService = (deps: NoteSnapshotDeps) => ({
    captureBaseline: async (input: {
        noteId: number;
        editSessionId?: string;
        meta?: string;
        baseline?: NoteRecord;
        force?: boolean;
    }) => {
        await deps.purgeExpiredSnapshots(createRetentionCutoff(SNAPSHOT_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);

        const existing =
            input.editSessionId && !input.force
                ? await deps.findSnapshotByEditSessionId(input.noteId, input.editSessionId)
                : null;

        if (existing) {
            return serializeSnapshot(existing);
        }

        const note = input.baseline ?? (await deps.findNoteById(input.noteId));

        if (!note) {
            return null;
        }

        const payload = serializePayload(note);
        const latestSnapshot = await deps.findLatestSnapshot(note.id);

        if (latestSnapshot && hasSameSnapshotPayload(latestSnapshot, payload)) {
            return serializeSnapshot(latestSnapshot);
        }

        const snapshot = await deps.createSnapshot({
            noteId: note.id,
            title: note.title,
            payload,
            ...(input.editSessionId && !input.force ? { editSessionId: input.editSessionId } : {}),
            ...(input.meta ? { meta: input.meta } : {}),
        });

        await deps.trimOverflowSnapshots(note.id, SNAPSHOT_MAX_PER_NOTE, RECOVERY_CLEANUP_BATCH_LIMIT);

        return serializeSnapshot(snapshot);
    },

    listSnapshots: async (noteId: number, limit = SNAPSHOT_MAX_PER_NOTE) => {
        await deps.purgeExpiredSnapshots(createRetentionCutoff(SNAPSHOT_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);
        await deps.trimOverflowSnapshots(noteId, SNAPSHOT_MAX_PER_NOTE, RECOVERY_CLEANUP_BATCH_LIMIT);
        const snapshots = await deps.listSnapshots(noteId, limit);
        return snapshots.map(serializeSnapshot);
    },

    getSnapshot: async (snapshotId: number) => {
        await deps.purgeExpiredSnapshots(createRetentionCutoff(SNAPSHOT_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);
        const snapshot = await deps.findSnapshotById(snapshotId);

        if (!snapshot) {
            return null;
        }

        return serializeSnapshotWithContent(snapshot);
    },

    restoreSnapshot: async (snapshotId: number, options?: { meta?: string }) => {
        await deps.purgeExpiredSnapshots(createRetentionCutoff(SNAPSHOT_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);

        const snapshot = await deps.findSnapshotById(snapshotId);

        if (!snapshot) {
            return null;
        }

        const note = await deps.findNoteById(snapshot.noteId);

        if (!note) {
            return null;
        }

        const payload = parsePayload(snapshot.payload);
        const resolvedTags = deps.resolveRestoredTags
            ? await deps.resolveRestoredTags(payload.content)
            : extractRestoredTagIds(payload.content);
        const restoredPayload =
            resolvedTags && !Array.isArray(resolvedTags)
                ? {
                      ...payload,
                      content: resolvedTags.content,
                  }
                : payload;
        const restoredTagIds = Array.isArray(resolvedTags) ? resolvedTags : resolvedTags?.tagIds;

        const currentPayload = serializePayload(note);
        const latestSnapshot = await deps.findLatestSnapshot(note.id);

        if (!hasSameSnapshotPayload(latestSnapshot, currentPayload)) {
            await deps.createSnapshot({
                noteId: note.id,
                title: note.title,
                payload: currentPayload,
                ...(options?.meta ? { meta: options.meta } : {}),
            });
        }

        const restoredNote = await deps.updateNote(snapshot.noteId, {
            ...restoredPayload,
            ...(restoredTagIds !== undefined ? { tagIds: restoredTagIds } : {}),
        });

        await deps.trimOverflowSnapshots(note.id, SNAPSHOT_MAX_PER_NOTE, RECOVERY_CLEANUP_BATCH_LIMIT);

        return restoredNote;
    },
});

export const defaultNoteSnapshotService = createNoteSnapshotService({
    findNoteById: async (id) => {
        return models.note.findUnique({ where: { id } });
    },
    findSnapshotByEditSessionId: async (noteId, editSessionId) => {
        return models.noteSnapshot.findFirst({
            where: {
                noteId,
                editSessionId,
            },
        });
    },
    findLatestSnapshot: async (noteId) => {
        return models.noteSnapshot.findFirst({
            where: { noteId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
    },
    createSnapshot: async (input) => {
        return models.noteSnapshot.create({
            data: {
                noteId: input.noteId,
                title: input.title,
                payload: input.payload,
                ...(input.editSessionId ? { editSessionId: input.editSessionId } : {}),
                ...(input.meta ? { meta: input.meta } : {}),
            },
        });
    },
    purgeExpiredSnapshots: defaultPurgeExpiredSnapshots,
    trimOverflowSnapshots: defaultTrimOverflowSnapshots,
    resolveRestoredTags: async (content) => {
        return resolveRestoredSnapshotTags(content, {
            ensureTagByName: async (name) => {
                const result = await ensureTagByName(name);
                return {
                    id: Number(result.tag.id),
                    name: result.tag.name,
                };
            },
            findTagsByIds: async (ids) => {
                return models.tag.findMany({
                    where: { id: { in: ids } },
                    select: {
                        id: true,
                        name: true,
                    },
                });
            },
        });
    },
    listSnapshots: async (noteId, limit) => {
        return models.noteSnapshot.findMany({
            where: { noteId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
        });
    },
    findSnapshotById: async (id) => {
        return models.noteSnapshot.findUnique({ where: { id } });
    },
    updateNote: async (id, input) => {
        const { tagIds, ...noteInput } = input;

        return models.note.update({
            where: { id },
            data: {
                ...noteInput,
                ...buildNoteSearchProjection({
                    title: noteInput.title,
                    content: noteInput.content,
                }),
                ...(tagIds !== undefined ? { tags: { set: tagIds.map((tagId) => ({ id: tagId })) } } : {}),
            },
        });
    },
});

export const captureNoteBaseline = async (input: {
    noteId: number;
    editSessionId?: string;
    meta?: string;
    baseline?: NoteRecord;
    force?: boolean;
}) => {
    return defaultNoteSnapshotService.captureBaseline(input);
};

export const listNoteSnapshots = async (noteId: number, limit?: number) => {
    return defaultNoteSnapshotService.listSnapshots(noteId, limit);
};

export const getNoteSnapshot = async (snapshotId: number) => {
    return defaultNoteSnapshotService.getSnapshot(snapshotId);
};

export const restoreNoteSnapshot = async (snapshotId: number, options?: { meta?: string }) => {
    return defaultNoteSnapshotService.restoreSnapshot(snapshotId, options);
};

export const purgeExpiredNoteSnapshots = async () => {
    return defaultPurgeExpiredSnapshots(createRetentionCutoff(SNAPSHOT_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);
};
