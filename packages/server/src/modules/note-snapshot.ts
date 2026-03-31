import models, { type NoteLayout } from '~/models.js';

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
    createSnapshot: (input: {
        noteId: number;
        title: string;
        payload: string;
        editSessionId?: string;
        meta?: string;
    }) => Promise<NoteSnapshotRecord>;
    listSnapshots: (noteId: number, limit: number) => Promise<NoteSnapshotRecord[]>;
    findSnapshotById: (id: number) => Promise<NoteSnapshotRecord | null>;
    updateNote: (id: number, input: {
        title: string;
        content: string;
        pinned: boolean;
        order: number;
        layout: NoteLayout;
    }) => Promise<NoteRecord>;
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
            ...(parsed.label ? { label: parsed.label } : {})
        };
    } catch {
        return {};
    }
};

const serializeSnapshot = (snapshot: NoteSnapshotRecord): NoteSnapshotSummary => ({
    id: String(snapshot.id),
    title: snapshot.title,
    createdAt: snapshot.createdAt.toISOString(),
    meta: parseMeta(snapshot.meta)
});

const serializePayload = (note: NoteRecord): string => {
    const payload: NoteSnapshotPayload = {
        title: note.title,
        content: note.content,
        pinned: note.pinned,
        order: note.order,
        layout: note.layout
    };

    return JSON.stringify(payload);
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
        label: isMobile ? 'Mobile browser' : 'Web browser'
    } satisfies NoteSnapshotMeta);
};

export const MCP_SNAPSHOT_META = JSON.stringify({
    entrypoint: 'mcp',
    label: 'MCP'
} satisfies NoteSnapshotMeta);

export const createNoteSnapshotService = (deps: NoteSnapshotDeps) => ({
    captureBaseline: async (input: {
        noteId: number;
        editSessionId?: string;
        meta?: string;
    }) => {
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

        const snapshot = await deps.createSnapshot({
            noteId: note.id,
            title: note.title,
            payload: serializePayload(note),
            ...(input.editSessionId ? { editSessionId: input.editSessionId } : {}),
            ...(input.meta ? { meta: input.meta } : {})
        });

        return serializeSnapshot(snapshot);
    },

    listSnapshots: async (noteId: number, limit = 5) => {
        const snapshots = await deps.listSnapshots(noteId, limit);
        return snapshots.map(serializeSnapshot);
    },

    restoreSnapshot: async (snapshotId: number, options?: { meta?: string }) => {
        const snapshot = await deps.findSnapshotById(snapshotId);

        if (!snapshot) {
            return null;
        }

        const note = await deps.findNoteById(snapshot.noteId);

        if (!note) {
            return null;
        }

        await deps.createSnapshot({
            noteId: note.id,
            title: note.title,
            payload: serializePayload(note),
            ...(options?.meta ? { meta: options.meta } : {})
        });

        const payload = parsePayload(snapshot.payload);

        return deps.updateNote(snapshot.noteId, payload);
    }
});

export const defaultNoteSnapshotService = createNoteSnapshotService({
    findNoteById: async (id) => {
        return models.note.findUnique({ where: { id } });
    },
    findSnapshotByEditSessionId: async (noteId, editSessionId) => {
        return models.noteSnapshot.findFirst({
            where: {
                noteId,
                editSessionId
            }
        });
    },
    createSnapshot: async (input) => {
        return models.noteSnapshot.create({
            data: {
                noteId: input.noteId,
                title: input.title,
                payload: input.payload,
                ...(input.editSessionId ? { editSessionId: input.editSessionId } : {}),
                ...(input.meta ? { meta: input.meta } : {})
            }
        });
    },
    listSnapshots: async (noteId, limit) => {
        return models.noteSnapshot.findMany({
            where: { noteId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    },
    findSnapshotById: async (id) => {
        return models.noteSnapshot.findUnique({ where: { id } });
    },
    updateNote: async (id, input) => {
        return models.note.update({
            where: { id },
            data: input
        });
    }
});

export const captureNoteBaseline = async (input: {
    noteId: number;
    editSessionId?: string;
    meta?: string;
}) => {
    return defaultNoteSnapshotService.captureBaseline(input);
};

export const listNoteSnapshots = async (noteId: number, limit?: number) => {
    return defaultNoteSnapshotService.listSnapshots(noteId, limit);
};

export const restoreNoteSnapshot = async (snapshotId: number, options?: { meta?: string }) => {
    return defaultNoteSnapshotService.restoreSnapshot(snapshotId, options);
};
