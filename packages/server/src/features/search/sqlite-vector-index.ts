import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getLoadablePath } from 'sqlite-vec';
import sqlite3 from 'sqlite3';
import type { NoteEmbeddingChunk } from './note-chunking.js';

export const SEMANTIC_INDEX_SCHEMA_VERSION = 1;

export interface SemanticIndexProfile {
    model: string;
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
                await exec(
                    database,
                    `
                        PRAGMA journal_mode = WAL;
                        PRAGMA synchronous = NORMAL;
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
                    `,
                );
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

    async getStatus() {
        return this.runExclusive(async () => this.getStatusFromDatabase(await this.getDatabase()));
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
