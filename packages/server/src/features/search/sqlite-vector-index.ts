import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getLoadablePath } from 'sqlite-vec';
import sqlite3 from 'sqlite3';
import type { NoteEmbeddingChunk } from './note-chunking.js';

export const SEMANTIC_INDEX_SCHEMA_VERSION = 2;
export const SEARCH_DATABASE_SCHEMA_VERSION = 1;

export interface SemanticIndexProfile {
    model: string;
    baseUrl: string;
    dimensions: number;
    queryInstruction: string;
    textSchemaVersion: number;
}

export interface IndexedNoteChunk extends NoteEmbeddingChunk {
    embedding: number[];
}

export interface SemanticVectorMatch {
    noteId: number;
    distance: number;
}

export interface SemanticIndexStatus {
    ready: boolean;
    profile: SemanticIndexProfile | null;
    noteCount: number;
    chunkCount: number;
    indexedAt: string | null;
}

export interface SemanticNoteSyncQueueEntry {
    noteId: number;
    version: number;
    firstQueuedAt: number;
    lastQueuedAt: number;
    attemptCount: number;
}

export interface SemanticNoteSyncQueueStatus {
    pendingNoteCount: number;
    oldestQueuedAt: string | null;
    lastSyncedAt: string | null;
    lastReconciledAt: string | null;
    error: string | null;
}

export interface ListPendingNoteSyncsOptions {
    now: number;
    quietPeriodMs: number;
    maxWaitMs: number;
    limit: number;
    force?: boolean;
}

export interface SemanticNoteSyncStore {
    enqueueNoteSync: (noteId: number, queuedAt: number) => Promise<void>;
    listPendingNoteSyncs: (options: ListPendingNoteSyncsOptions) => Promise<SemanticNoteSyncQueueEntry[]>;
    completeNoteSyncs: (entries: SemanticNoteSyncQueueEntry[], completedAt: number) => Promise<void>;
    failNoteSyncs: (entries: SemanticNoteSyncQueueEntry[], error: string, retryAt: number) => Promise<void>;
    recordNoteSyncSuccess: (completedAt: number) => Promise<void>;
    recordNoteSyncReconciliation: (reconciledAt: number) => Promise<void>;
    getNoteSyncQueueStatus: () => Promise<SemanticNoteSyncQueueStatus>;
}

type SqliteParameters = unknown[] | Record<string, unknown>;

interface SearchIndexStateRow {
    profileJson: string;
    noteCount: number;
    chunkCount: number;
    indexedAt: string;
}

interface SemanticMatchRow {
    noteId: number;
    distance: number;
}

interface SourceHashRow {
    noteId?: number;
    sourceHash: string;
}

interface IndexCountsRow {
    noteCount: number;
    chunkCount: number;
}

interface NoteSyncQueueRow {
    noteId: number;
    version: number;
    firstQueuedAt: number;
    lastQueuedAt: number;
    attemptCount: number;
}

interface NoteSyncQueueStatusRow {
    pendingNoteCount: number;
    oldestQueuedAt: number | null;
}

interface NoteSyncStateRow {
    lastSyncedAt: string | null;
    lastReconciledAt: string | null;
}

interface NoteSyncErrorRow {
    error: string;
}

interface DatabaseSchemaVersionRow {
    userVersion: number;
}

const SEARCH_DATABASE_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS search_index_state (
        id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
        schema_version INTEGER NOT NULL,
        profile_json TEXT NOT NULL,
        note_count INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        indexed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS search_chunks (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        source_hash TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding BLOB NOT NULL,
        UNIQUE (note_id, chunk_index)
    );
    CREATE INDEX IF NOT EXISTS search_chunks_note_id_idx ON search_chunks(note_id);
    CREATE TABLE IF NOT EXISTS search_note_sync_queue (
        note_id INTEGER NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL,
        first_queued_at INTEGER NOT NULL,
        last_queued_at INTEGER NOT NULL,
        attempt_count INTEGER NOT NULL,
        next_attempt_at INTEGER NOT NULL,
        last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS search_note_sync_queue_ready_idx
        ON search_note_sync_queue(next_attempt_at, first_queued_at);
    CREATE TABLE IF NOT EXISTS search_note_sync_state (
        id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
        last_synced_at TEXT,
        last_reconciled_at TEXT
    );
`;

const RESET_SEARCH_DATABASE_SCHEMA_SQL = `
    DROP TABLE IF EXISTS search_note_sync_queue;
    DROP TABLE IF EXISTS search_note_sync_state;
    DROP TABLE IF EXISTS search_chunks;
    DROP TABLE IF EXISTS search_index_state;
`;

const openDatabase = async (filePath: string) => {
    if (filePath !== ':memory:') {
        await mkdir(path.dirname(filePath), { recursive: true });
    }

    const database = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new sqlite3.Database(filePath, (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(db);
        });
    });

    await new Promise<void>((resolve, reject) => {
        database.loadExtension(getLoadablePath(), (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });

    return database;
};

const run = (database: sqlite3.Database, sql: string, parameters: SqliteParameters = []) => {
    return new Promise<sqlite3.RunResult>((resolve, reject) => {
        database.run(sql, parameters, function onRun(error) {
            if (error) {
                reject(error);
                return;
            }

            resolve(this);
        });
    });
};

const get = <T>(database: sqlite3.Database, sql: string, parameters: SqliteParameters = []) => {
    return new Promise<T | undefined>((resolve, reject) => {
        database.get<T>(sql, parameters, (error, row) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(row);
        });
    });
};

const all = <T>(database: sqlite3.Database, sql: string, parameters: SqliteParameters = []) => {
    return new Promise<T[]>((resolve, reject) => {
        database.all<T>(sql, parameters, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });
    });
};

const exec = (database: sqlite3.Database, sql: string) => {
    return new Promise<void>((resolve, reject) => {
        database.exec(sql, (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
};

const initializeSearchDatabase = async (database: sqlite3.Database) => {
    await exec(
        database,
        `
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
        `,
    );
    const schemaVersion = await get<DatabaseSchemaVersionRow>(
        database,
        'SELECT user_version AS userVersion FROM pragma_user_version',
    );
    const storedVersion = schemaVersion?.userVersion ?? 0;

    if (storedVersion !== 0 && storedVersion !== SEARCH_DATABASE_SCHEMA_VERSION) {
        await exec(database, RESET_SEARCH_DATABASE_SCHEMA_SQL);
    }

    await exec(database, SEARCH_DATABASE_SCHEMA_SQL);
    await exec(database, `PRAGMA user_version = ${SEARCH_DATABASE_SCHEMA_VERSION};`);
};

const close = (database: sqlite3.Database) => {
    return new Promise<void>((resolve, reject) => {
        database.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
};

const serializeEmbedding = (embedding: number[]) => {
    return Buffer.from(Float32Array.from(embedding).buffer);
};

const isSemanticIndexProfile = (value: unknown): value is SemanticIndexProfile => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const profile = value as Partial<SemanticIndexProfile>;
    return (
        typeof profile.model === 'string' &&
        typeof profile.baseUrl === 'string' &&
        Number.isInteger(profile.dimensions) &&
        Number(profile.dimensions) > 0 &&
        typeof profile.queryInstruction === 'string' &&
        Number.isInteger(profile.textSchemaVersion)
    );
};

const parseProfile = (profileJson: string) => {
    try {
        const profile = JSON.parse(profileJson) as unknown;
        return isSemanticIndexProfile(profile) ? profile : null;
    } catch {
        return null;
    }
};

const validateIndexInput = (profile: SemanticIndexProfile, chunks: IndexedNoteChunk[]) => {
    if (!profile.model.trim()) {
        throw new Error('Semantic index profile model is required.');
    }

    if (!profile.baseUrl.trim()) {
        throw new Error('Semantic index profile API URL is required.');
    }

    if (!Number.isInteger(profile.dimensions) || profile.dimensions <= 0) {
        throw new Error('Semantic index dimensions must be a positive integer.');
    }

    for (const chunk of chunks) {
        if (chunk.embedding.length !== profile.dimensions) {
            throw new Error(
                `Embedding dimensions for note ${chunk.noteId} chunk ${chunk.chunkIndex} do not match the index profile.`,
            );
        }

        if (chunk.embedding.some((value) => !Number.isFinite(value))) {
            throw new Error(`Embedding for note ${chunk.noteId} chunk ${chunk.chunkIndex} contains an invalid value.`);
        }
    }
};

export class SqliteSemanticVectorIndex {
    private databasePromise: Promise<sqlite3.Database> | null = null;
    private operationTail: Promise<void> = Promise.resolve();

    constructor(private readonly filePath: string) {}

    private getDatabase() {
        if (!this.databasePromise) {
            this.databasePromise = openDatabase(this.filePath).then(async (database) => {
                await initializeSearchDatabase(database);
                return database;
            });
        }

        return this.databasePromise;
    }

    private runExclusive<T>(operation: () => Promise<T>) {
        const result = this.operationTail.then(operation, operation);
        this.operationTail = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    }

    async replaceAll(profile: SemanticIndexProfile, chunks: IndexedNoteChunk[]) {
        validateIndexInput(profile, chunks);

        return this.runExclusive(async () => {
            const database = await this.getDatabase();
            const indexedAt = new Date().toISOString();
            const noteCount = new Set(chunks.map((chunk) => chunk.noteId)).size;

            await exec(database, 'BEGIN IMMEDIATE;');
            try {
                await run(database, 'DELETE FROM search_chunks');
                await run(database, 'DELETE FROM search_index_state');

                for (const chunk of chunks) {
                    await run(
                        database,
                        `
                            INSERT INTO search_chunks (
                                note_id,
                                chunk_index,
                                source_hash,
                                text,
                                embedding
                            ) VALUES (?, ?, ?, ?, ?)
                        `,
                        [
                            chunk.noteId,
                            chunk.chunkIndex,
                            chunk.sourceHash,
                            chunk.text,
                            serializeEmbedding(chunk.embedding),
                        ],
                    );
                }

                await run(
                    database,
                    `
                        INSERT INTO search_index_state (
                            id,
                            schema_version,
                            profile_json,
                            note_count,
                            chunk_count,
                            indexed_at
                        ) VALUES (1, ?, ?, ?, ?, ?)
                    `,
                    [SEMANTIC_INDEX_SCHEMA_VERSION, JSON.stringify(profile), noteCount, chunks.length, indexedAt],
                );
                await exec(database, 'COMMIT;');
            } catch (error) {
                await exec(database, 'ROLLBACK;');
                throw error;
            }

            return this.getStatusFromDatabase(database);
        });
    }

    private async getStatusFromDatabase(database: sqlite3.Database): Promise<SemanticIndexStatus> {
        const state = await get<SearchIndexStateRow>(
            database,
            `
                SELECT
                    profile_json AS profileJson,
                    note_count AS noteCount,
                    chunk_count AS chunkCount,
                    indexed_at AS indexedAt
                FROM search_index_state
                WHERE id = 1 AND schema_version = ?
            `,
            [SEMANTIC_INDEX_SCHEMA_VERSION],
        );
        const profile = state ? parseProfile(state.profileJson) : null;

        return {
            ready: Boolean(state && profile && state.chunkCount > 0),
            profile,
            noteCount: state?.noteCount ?? 0,
            chunkCount: state?.chunkCount ?? 0,
            indexedAt: state?.indexedAt ?? null,
        };
    }

    private async refreshIndexCounts(database: sqlite3.Database) {
        const counts = await get<IndexCountsRow>(
            database,
            `
                SELECT
                    COUNT(DISTINCT note_id) AS noteCount,
                    COUNT(*) AS chunkCount
                FROM search_chunks
            `,
        );
        await run(
            database,
            `
                UPDATE search_index_state
                SET note_count = ?, chunk_count = ?, indexed_at = ?
                WHERE id = 1 AND schema_version = ?
            `,
            [counts?.noteCount ?? 0, counts?.chunkCount ?? 0, new Date().toISOString(), SEMANTIC_INDEX_SCHEMA_VERSION],
        );
    }

    async getStatus() {
        return this.runExclusive(async () => this.getStatusFromDatabase(await this.getDatabase()));
    }

    async getNoteSourceHash(noteId: number) {
        return this.runExclusive(async () => {
            const row = await get<SourceHashRow>(
                await this.getDatabase(),
                'SELECT source_hash AS sourceHash FROM search_chunks WHERE note_id = ? LIMIT 1',
                [noteId],
            );
            return row?.sourceHash ?? null;
        });
    }

    async getAllNoteSourceHashes() {
        return this.runExclusive(async () => {
            const rows = await all<Required<SourceHashRow>>(
                await this.getDatabase(),
                `
                    SELECT note_id AS noteId, source_hash AS sourceHash
                    FROM search_chunks
                    GROUP BY note_id, source_hash
                    ORDER BY note_id ASC
                `,
            );
            return new Map(rows.map((row) => [row.noteId, row.sourceHash]));
        });
    }

    async enqueueNoteSync(noteId: number, queuedAt: number) {
        if (!Number.isInteger(noteId) || noteId <= 0) {
            throw new Error('A positive note ID is required to queue semantic search synchronization.');
        }
        if (!Number.isFinite(queuedAt) || queuedAt < 0) {
            throw new Error('A valid queue timestamp is required for semantic search synchronization.');
        }

        return this.runExclusive(async () => {
            await run(
                await this.getDatabase(),
                `
                    INSERT INTO search_note_sync_queue (
                        note_id,
                        version,
                        first_queued_at,
                        last_queued_at,
                        attempt_count,
                        next_attempt_at,
                        last_error
                    ) VALUES (?, 1, ?, ?, 0, ?, NULL)
                    ON CONFLICT(note_id) DO UPDATE SET
                        version = search_note_sync_queue.version + 1,
                        last_queued_at = excluded.last_queued_at,
                        attempt_count = 0,
                        next_attempt_at = excluded.next_attempt_at,
                        last_error = NULL
                `,
                [noteId, queuedAt, queuedAt, queuedAt],
            );
        });
    }

    async listPendingNoteSyncs({
        now,
        quietPeriodMs,
        maxWaitMs,
        limit,
        force = false,
    }: ListPendingNoteSyncsOptions): Promise<SemanticNoteSyncQueueEntry[]> {
        if (![now, quietPeriodMs, maxWaitMs].every((value) => Number.isFinite(value) && value >= 0)) {
            throw new Error('Semantic search synchronization timing values must be non-negative numbers.');
        }
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new Error('Semantic search synchronization batch limit must be a positive integer.');
        }

        return this.runExclusive(async () => {
            return all<NoteSyncQueueRow>(
                await this.getDatabase(),
                `
                    SELECT
                        note_id AS noteId,
                        version,
                        first_queued_at AS firstQueuedAt,
                        last_queued_at AS lastQueuedAt,
                        attempt_count AS attemptCount
                    FROM search_note_sync_queue
                    WHERE
                        ? = 1
                        OR (
                            next_attempt_at <= ?
                            AND (
                                last_queued_at <= ?
                                OR first_queued_at <= ?
                            )
                        )
                    ORDER BY first_queued_at ASC, note_id ASC
                    LIMIT ?
                `,
                [force ? 1 : 0, now, now - quietPeriodMs, now - maxWaitMs, limit],
            );
        });
    }

    async completeNoteSyncs(entries: SemanticNoteSyncQueueEntry[], completedAt: number) {
        return this.runExclusive(async () => {
            const database = await this.getDatabase();
            await exec(database, 'BEGIN IMMEDIATE;');
            try {
                for (const entry of entries) {
                    await run(database, 'DELETE FROM search_note_sync_queue WHERE note_id = ? AND version = ?', [
                        entry.noteId,
                        entry.version,
                    ]);
                }
                await run(
                    database,
                    `
                        INSERT INTO search_note_sync_state (id, last_synced_at, last_reconciled_at)
                        VALUES (1, ?, NULL)
                        ON CONFLICT(id) DO UPDATE SET last_synced_at = excluded.last_synced_at
                    `,
                    [new Date(completedAt).toISOString()],
                );
                await exec(database, 'COMMIT;');
            } catch (error) {
                await exec(database, 'ROLLBACK;');
                throw error;
            }
        });
    }

    async failNoteSyncs(entries: SemanticNoteSyncQueueEntry[], error: string, retryAt: number) {
        return this.runExclusive(async () => {
            const database = await this.getDatabase();
            await exec(database, 'BEGIN IMMEDIATE;');
            try {
                for (const entry of entries) {
                    await run(
                        database,
                        `
                            UPDATE search_note_sync_queue
                            SET attempt_count = attempt_count + 1,
                                next_attempt_at = ?,
                                last_error = ?
                            WHERE note_id = ? AND version = ?
                        `,
                        [retryAt, error, entry.noteId, entry.version],
                    );
                }
                await exec(database, 'COMMIT;');
            } catch (transactionError) {
                await exec(database, 'ROLLBACK;');
                throw transactionError;
            }
        });
    }

    async recordNoteSyncSuccess(completedAt: number) {
        return this.completeNoteSyncs([], completedAt);
    }

    async recordNoteSyncReconciliation(reconciledAt: number) {
        return this.runExclusive(async () => {
            await run(
                await this.getDatabase(),
                `
                    INSERT INTO search_note_sync_state (id, last_synced_at, last_reconciled_at)
                    VALUES (1, NULL, ?)
                    ON CONFLICT(id) DO UPDATE SET last_reconciled_at = excluded.last_reconciled_at
                `,
                [new Date(reconciledAt).toISOString()],
            );
        });
    }

    async getNoteSyncQueueStatus(): Promise<SemanticNoteSyncQueueStatus> {
        return this.runExclusive(async () => {
            const database = await this.getDatabase();
            const [queue, state, latestError] = await Promise.all([
                get<NoteSyncQueueStatusRow>(
                    database,
                    `
                        SELECT
                            COUNT(*) AS pendingNoteCount,
                            MIN(first_queued_at) AS oldestQueuedAt
                        FROM search_note_sync_queue
                    `,
                ),
                get<NoteSyncStateRow>(
                    database,
                    `
                        SELECT
                            last_synced_at AS lastSyncedAt,
                            last_reconciled_at AS lastReconciledAt
                        FROM search_note_sync_state
                        WHERE id = 1
                    `,
                ),
                get<NoteSyncErrorRow>(
                    database,
                    `
                        SELECT last_error AS error
                        FROM search_note_sync_queue
                        WHERE last_error IS NOT NULL
                        ORDER BY next_attempt_at DESC, note_id ASC
                        LIMIT 1
                    `,
                ),
            ]);

            return {
                pendingNoteCount: queue?.pendingNoteCount ?? 0,
                oldestQueuedAt:
                    queue?.oldestQueuedAt === null || queue?.oldestQueuedAt === undefined
                        ? null
                        : new Date(queue.oldestQueuedAt).toISOString(),
                lastSyncedAt: state?.lastSyncedAt ?? null,
                lastReconciledAt: state?.lastReconciledAt ?? null,
                error: latestError?.error ?? null,
            };
        });
    }

    async replaceNote(noteId: number, chunks: IndexedNoteChunk[]) {
        return this.runExclusive(async () => {
            const database = await this.getDatabase();
            const status = await this.getStatusFromDatabase(database);
            if (!status.ready || !status.profile) {
                throw new Error('Build the semantic index before updating an individual note.');
            }
            if (chunks.some((chunk) => chunk.noteId !== noteId)) {
                throw new Error('Every replacement chunk must belong to the requested note.');
            }
            validateIndexInput(status.profile, chunks);

            await exec(database, 'BEGIN IMMEDIATE;');
            try {
                await run(database, 'DELETE FROM search_chunks WHERE note_id = ?', [noteId]);
                for (const chunk of chunks) {
                    await run(
                        database,
                        `
                            INSERT INTO search_chunks (
                                note_id,
                                chunk_index,
                                source_hash,
                                text,
                                embedding
                            ) VALUES (?, ?, ?, ?, ?)
                        `,
                        [
                            chunk.noteId,
                            chunk.chunkIndex,
                            chunk.sourceHash,
                            chunk.text,
                            serializeEmbedding(chunk.embedding),
                        ],
                    );
                }
                await this.refreshIndexCounts(database);
                await exec(database, 'COMMIT;');
            } catch (error) {
                await exec(database, 'ROLLBACK;');
                throw error;
            }

            return this.getStatusFromDatabase(database);
        });
    }

    async removeNote(noteId: number) {
        return this.runExclusive(async () => {
            const database = await this.getDatabase();
            await exec(database, 'BEGIN IMMEDIATE;');
            try {
                await run(database, 'DELETE FROM search_chunks WHERE note_id = ?', [noteId]);
                await this.refreshIndexCounts(database);
                await exec(database, 'COMMIT;');
            } catch (error) {
                await exec(database, 'ROLLBACK;');
                throw error;
            }

            return this.getStatusFromDatabase(database);
        });
    }

    async search(queryEmbedding: number[], limit: number): Promise<SemanticVectorMatch[]> {
        if (!Number.isInteger(limit) || limit <= 0) {
            return [];
        }

        return this.runExclusive(async () => {
            const database = await this.getDatabase();
            const status = await this.getStatusFromDatabase(database);

            if (!status.ready || !status.profile) {
                return [];
            }

            if (queryEmbedding.length !== status.profile.dimensions) {
                throw new Error(
                    `Query embedding has ${queryEmbedding.length} dimensions but the index requires ${status.profile.dimensions}.`,
                );
            }

            if (queryEmbedding.some((value) => !Number.isFinite(value))) {
                throw new Error('Query embedding contains an invalid value.');
            }

            const rows = await all<SemanticMatchRow>(
                database,
                `
                    SELECT
                        note_id AS noteId,
                        MIN(vec_distance_cosine(embedding, ?)) AS distance
                    FROM search_chunks
                    GROUP BY note_id
                    ORDER BY distance ASC, note_id ASC
                    LIMIT ?
                `,
                [serializeEmbedding(queryEmbedding), limit],
            );

            return rows.map((row) => ({ noteId: row.noteId, distance: row.distance }));
        });
    }

    async clear() {
        return this.runExclusive(async () => {
            const database = await this.getDatabase();
            await exec(database, 'BEGIN IMMEDIATE;');
            try {
                await run(database, 'DELETE FROM search_chunks');
                await run(database, 'DELETE FROM search_index_state');
                await exec(database, 'COMMIT;');
            } catch (error) {
                await exec(database, 'ROLLBACK;');
                throw error;
            }
        });
    }

    async close() {
        await this.operationTail;
        if (!this.databasePromise) {
            return;
        }

        const database = await this.databasePromise;
        this.databasePromise = null;
        await close(database);
    }
}
