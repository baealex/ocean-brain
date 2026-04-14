import models, { type NoteLayout } from '~/models.js';
import { buildNoteSearchProjection } from './note-search.js';
import {
    createRetentionCutoff,
    RECOVERY_CLEANUP_BATCH_LIMIT,
    SNAPSHOT_MAX_PER_NOTE,
    SNAPSHOT_RETENTION_DAYS,
} from './recovery-retention.js';

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
    updateNote: (
        id: number,
        input: {
            title: string;
            content: string;
            pinned: boolean;
            order: number;
            layout: NoteLayout;
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

export interface NoteSnapshotSummary {
    id: string;
    title: string;
    createdAt: string;
    meta: NoteSnapshotMeta;
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

const serializeSnapshot = (snapshot: NoteSnapshotRecord): NoteSnapshotSummary => ({
    id: String(snapshot.id),
    title: snapshot.title,
    createdAt: snapshot.createdAt.toISOString(),
    meta: parseMeta(snapshot.meta),
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
    captureBaseline: async (input: { noteId: number; editSessionId?: string; meta?: string }) => {
        await deps.purgeExpiredSnapshots(createRetentionCutoff(SNAPSHOT_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);

        const existing = input.editSessionId
            ? await deps.findSnapshotByEditSessionId(input.noteId, input.editSessionId)
            : null;

        if (existing) {
            return serializeSnapshot(existing);
        }

        const note = await deps.findNoteById(input.noteId);

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
            ...(input.editSessionId ? { editSessionId: input.editSessionId } : {}),
            ...(input.meta ? { meta: input.meta } : {}),
        });

        await deps.trimOverflowSnapshots(note.id, SNAPSHOT_MAX_PER_NOTE, RECOVERY_CLEANUP_BATCH_LIMIT);

        return serializeSnapshot(snapshot);
    },

    listSnapshots: async (noteId: number, limit = 5) => {
        await deps.purgeExpiredSnapshots(createRetentionCutoff(SNAPSHOT_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);
        await deps.trimOverflowSnapshots(noteId, SNAPSHOT_MAX_PER_NOTE, RECOVERY_CLEANUP_BATCH_LIMIT);
        const snapshots = await deps.listSnapshots(noteId, limit);
        return snapshots.map(serializeSnapshot);
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

        await deps.trimOverflowSnapshots(note.id, SNAPSHOT_MAX_PER_NOTE, RECOVERY_CLEANUP_BATCH_LIMIT);

        const payload = parsePayload(snapshot.payload);

        return deps.updateNote(snapshot.noteId, payload);
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
        return models.note.update({
            where: { id },
            data: {
                ...input,
                ...buildNoteSearchProjection({
                    title: input.title,
                    content: input.content,
                }),
            },
        });
    },
});

export const captureNoteBaseline = async (input: { noteId: number; editSessionId?: string; meta?: string }) => {
    return defaultNoteSnapshotService.captureBaseline(input);
};

export const listNoteSnapshots = async (noteId: number, limit?: number) => {
    return defaultNoteSnapshotService.listSnapshots(noteId, limit);
};

export const restoreNoteSnapshot = async (snapshotId: number, options?: { meta?: string }) => {
    return defaultNoteSnapshotService.restoreSnapshot(snapshotId, options);
};

export const purgeExpiredNoteSnapshots = async () => {
    return defaultPurgeExpiredSnapshots(createRetentionCutoff(SNAPSHOT_RETENTION_DAYS), RECOVERY_CLEANUP_BATCH_LIMIT);
};
