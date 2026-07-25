import type { EmbeddingClient } from './embedding-client.js';
import {
    buildNoteEmbeddingChunks,
    NOTE_EMBEDDING_TEXT_SCHEMA_VERSION,
    type SemanticSearchNoteInput,
} from './note-chunking.js';
import type {
    IndexedNoteChunk,
    SemanticIndexProfile,
    SemanticIndexStatus,
    SemanticVectorMatch,
} from './sqlite-vector-index.js';

export interface SemanticVectorIndex {
    clear: () => Promise<void>;
    getStatus: () => Promise<SemanticIndexStatus>;
    getAllNoteSourceHashes: () => Promise<Map<number, string>>;
    getNoteSourceHash: (noteId: number) => Promise<string | null>;
    removeNote: (noteId: number) => Promise<SemanticIndexStatus>;
    replaceAll: (profile: SemanticIndexProfile, chunks: IndexedNoteChunk[]) => Promise<SemanticIndexStatus>;
    replaceNote: (noteId: number, chunks: IndexedNoteChunk[]) => Promise<SemanticIndexStatus>;
    search: (queryEmbedding: number[], limit: number) => Promise<SemanticVectorMatch[]>;
}

interface BuildSemanticIndexInput {
    notes: SemanticSearchNoteInput[];
    embeddingClient: EmbeddingClient;
    vectorIndex: SemanticVectorIndex;
    model: string;
    baseUrl: string;
    queryInstruction: string;
    batchSize?: number;
    onProgress?: (progress: SemanticIndexBuildProgress) => void;
}

export interface SemanticIndexBuildProgress {
    processedChunks: number;
    totalChunks: number;
}

const DEFAULT_EMBEDDING_BATCH_SIZE = 16;

const validateBatchSize = (batchSize: number) => {
    if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 256) {
        throw new Error('Embedding batch size must be an integer between 1 and 256.');
    }
};

const embedChunks = async (
    chunks: ReturnType<typeof buildNoteEmbeddingChunks>,
    embeddingClient: EmbeddingClient,
    batchSize: number,
    onProgress?: (processedChunks: number) => void,
) => {
    const indexedChunks: IndexedNoteChunk[] = [];
    let dimensions: number | null = null;

    for (let start = 0; start < chunks.length; start += batchSize) {
        const batch = chunks.slice(start, start + batchSize);
        const embeddings = await embeddingClient.embedDocuments(batch.map((chunk) => chunk.text));

        if (embeddings.length !== batch.length) {
            throw new Error(`Embedding provider returned ${embeddings.length} vectors for ${batch.length} chunks.`);
        }

        embeddings.forEach((embedding, index) => {
            dimensions ??= embedding.length;
            if (embedding.length !== dimensions) {
                throw new Error('Embedding provider changed vector dimensions while building the index.');
            }

            indexedChunks.push({
                ...batch[index],
                embedding,
            });
        });

        onProgress?.(indexedChunks.length);
    }

    return { indexedChunks, dimensions };
};

export const buildSemanticSearchIndex = async ({
    notes,
    embeddingClient,
    vectorIndex,
    model,
    baseUrl,
    queryInstruction,
    batchSize = DEFAULT_EMBEDDING_BATCH_SIZE,
    onProgress,
}: BuildSemanticIndexInput) => {
    validateBatchSize(batchSize);

    const chunks = notes.flatMap((note) => buildNoteEmbeddingChunks(note));
    const totalChunks = chunks.length;
    onProgress?.({ processedChunks: 0, totalChunks });

    if (totalChunks === 0) {
        await vectorIndex.clear();
        return vectorIndex.getStatus();
    }

    const { indexedChunks, dimensions } = await embedChunks(chunks, embeddingClient, batchSize, (processedChunks) =>
        onProgress?.({ processedChunks, totalChunks }),
    );

    if (!dimensions) {
        throw new Error('Embedding provider returned no vector dimensions.');
    }

    return vectorIndex.replaceAll(
        {
            model,
            baseUrl,
            dimensions,
            queryInstruction,
            textSchemaVersion: NOTE_EMBEDDING_TEXT_SCHEMA_VERSION,
        },
        indexedChunks,
    );
};

export const updateSemanticSearchNote = async ({
    note,
    embeddingClient,
    vectorIndex,
    batchSize = DEFAULT_EMBEDDING_BATCH_SIZE,
}: {
    note: SemanticSearchNoteInput;
    embeddingClient: EmbeddingClient;
    vectorIndex: SemanticVectorIndex;
    batchSize?: number;
}) => {
    validateBatchSize(batchSize);
    const chunks = buildNoteEmbeddingChunks(note);
    const sourceHash = chunks[0]?.sourceHash ?? null;
    const indexedSourceHash = await vectorIndex.getNoteSourceHash(note.id);

    if (sourceHash === indexedSourceHash) {
        return vectorIndex.getStatus();
    }

    if (chunks.length === 0) {
        return vectorIndex.removeNote(note.id);
    }

    const { indexedChunks } = await embedChunks(chunks, embeddingClient, batchSize);
    return vectorIndex.replaceNote(note.id, indexedChunks);
};

export const updateSemanticSearchNotes = async ({
    notes,
    removedNoteIds,
    embeddingClient,
    vectorIndex,
    batchSize = DEFAULT_EMBEDDING_BATCH_SIZE,
}: {
    notes: SemanticSearchNoteInput[];
    removedNoteIds: number[];
    embeddingClient: EmbeddingClient;
    vectorIndex: SemanticVectorIndex;
    batchSize?: number;
}) => {
    validateBatchSize(batchSize);
    const changedNotes: Array<{
        note: SemanticSearchNoteInput;
        chunks: ReturnType<typeof buildNoteEmbeddingChunks>;
    }> = [];

    for (const note of notes) {
        const chunks = buildNoteEmbeddingChunks(note);
        const sourceHash = chunks[0]?.sourceHash ?? null;
        const indexedSourceHash = await vectorIndex.getNoteSourceHash(note.id);

        if (sourceHash !== indexedSourceHash) {
            changedNotes.push({ note, chunks });
        }
    }

    const chunksToEmbed = changedNotes.flatMap(({ chunks }) => chunks);
    const { indexedChunks } = await embedChunks(chunksToEmbed, embeddingClient, batchSize);

    for (const { note, chunks } of changedNotes) {
        if (chunks.length === 0) {
            await vectorIndex.removeNote(note.id);
            continue;
        }

        await vectorIndex.replaceNote(
            note.id,
            indexedChunks.filter((chunk) => chunk.noteId === note.id),
        );
    }

    for (const noteId of new Set(removedNoteIds)) {
        await vectorIndex.removeNote(noteId);
    }

    return vectorIndex.getStatus();
};

export const searchSemanticIndex = async (
    query: string,
    limit: number,
    embeddingClient: EmbeddingClient,
    vectorIndex: SemanticVectorIndex,
) => {
    const status = await vectorIndex.getStatus();
    if (!status.ready) {
        return [];
    }

    const queryEmbedding = await embeddingClient.embedQuery(query);
    return vectorIndex.search(queryEmbedding, limit);
};
