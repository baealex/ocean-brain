import { createHash } from 'node:crypto';
import { type NoteChangeEvent, subscribeNoteChanges } from '~/features/note/services/change-events.js';
import models from '~/models.js';
import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import { subscribeIntegrationAccessChanges } from './access-events.js';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
const KEEP_ALIVE_INTERVAL_MS = 30_000;
const MAX_STREAMS_PER_CONNECTION = 2;
const MAX_NOTE_ID = 2_147_483_647;
const activeStreamsByConnection = new Map<string, number>();

const resolvePageSize = (value: unknown) => {
    if (value === undefined) return DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > MAX_PAGE_SIZE) {
        throw createAppError(
            400,
            'INVALID_NOTE_CATALOG_PAGE_SIZE',
            `limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
        );
    }
    return Number(value);
};

const resolveAfterId = (value: unknown) => {
    if (value === undefined) return 0;
    const normalized = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
    if (typeof normalized !== 'string' || !/^(0|[1-9]\d*)$/.test(normalized)) {
        throw createAppError(400, 'INVALID_NOTE_CATALOG_CURSOR', 'afterId must be a nonnegative integer.');
    }
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed > MAX_NOTE_ID) {
        throw createAppError(400, 'INVALID_NOTE_CATALOG_CURSOR', 'afterId exceeds the supported range.');
    }
    return parsed;
};

export const createIntegrationNoteCatalogHandler = (): Controller => {
    return async (request, reply) => {
        const limit = resolvePageSize(request.body?.limit);
        const afterId = resolveAfterId(request.body?.afterId);
        const [rows, propertySchema] = await Promise.all([
            models.note.findMany({
                where: { id: { gt: afterId } },
                orderBy: { id: 'asc' },
                take: limit + 1,
                select: { id: true, updatedAt: true },
            }),
            afterId === 0
                ? models.propertyDefinition.findMany({
                      orderBy: { key: 'asc' },
                      select: {
                          key: true,
                          name: true,
                          valueType: true,
                          updatedAt: true,
                          options: {
                              orderBy: [{ order: 'asc' }, { id: 'asc' }],
                              select: {
                                  id: true,
                                  label: true,
                                  value: true,
                                  color: true,
                                  order: true,
                                  updatedAt: true,
                              },
                          },
                      },
                  })
                : Promise.resolve(null),
        ]);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;

        return reply.status(200).send({
            notes: page.map((note) => ({ id: String(note.id), updatedAt: note.updatedAt.toISOString() })),
            ...(propertySchema
                ? { propertySchemaHash: createHash('sha256').update(JSON.stringify(propertySchema)).digest('hex') }
                : {}),
            hasMore,
            nextAfterId: hasMore ? String(page.at(-1)?.id) : null,
        });
    };
};

export const serializeIntegrationNoteEvent = (event: NoteChangeEvent) => {
    const data = {
        type: event.type,
        noteId: String(event.noteId),
        occurredAt: event.occurredAt,
    };

    return `event: ${event.type}\ndata: ${JSON.stringify(data)}\n\n`;
};

export const createIntegrationNoteEventsHandler = (
    subscribe: typeof subscribeNoteChanges = subscribeNoteChanges,
): Controller => {
    return async (request, reply) => {
        const connectionId = request.integration?.connectionId;
        if (!connectionId) {
            throw createAppError(401, 'UNAUTHORIZED', 'An authenticated integration connection is required.');
        }
        const activeStreamCount = activeStreamsByConnection.get(connectionId) ?? 0;
        if (activeStreamCount >= MAX_STREAMS_PER_CONNECTION) {
            throw createAppError(
                429,
                'INTEGRATION_EVENT_STREAM_LIMIT',
                `A connection can open at most ${MAX_STREAMS_PER_CONNECTION} event streams.`,
            );
        }

        reply.hijack();
        const response = reply.raw;
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache, no-transform');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('X-Accel-Buffering', 'no');
        response.flushHeaders();
        response.write(': connected\n\n');

        activeStreamsByConnection.set(connectionId, activeStreamCount + 1);
        let cleanedUp = false;
        let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
        let unsubscribeNoteChanges: () => void = () => undefined;
        let unsubscribeAccessChanges: () => void = () => undefined;
        const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            unsubscribeNoteChanges();
            unsubscribeAccessChanges();
            const remainingStreams = (activeStreamsByConnection.get(connectionId) ?? 1) - 1;
            if (remainingStreams > 0) activeStreamsByConnection.set(connectionId, remainingStreams);
            else activeStreamsByConnection.delete(connectionId);
        };
        const endStream = () => {
            cleanup();
            if (!response.writableEnded) {
                try {
                    response.end();
                } catch {
                    // The socket is already unusable; cleanup above released every listener.
                }
            }
        };
        const write = (chunk: string) => {
            try {
                if (!response.write(chunk)) endStream();
            } catch {
                endStream();
            }
        };

        unsubscribeNoteChanges = subscribe((event) => write(serializeIntegrationNoteEvent(event)));
        unsubscribeAccessChanges = subscribeIntegrationAccessChanges((changedConnectionId) => {
            if (changedConnectionId === connectionId) endStream();
        });
        keepAliveTimer = setInterval(() => write(': keepalive\n\n'), KEEP_ALIVE_INTERVAL_MS);
        keepAliveTimer.unref?.();
        request.raw.on('close', cleanup);
        response.on('close', cleanup);
    };
};
