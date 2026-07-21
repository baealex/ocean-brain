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
    replaceAll: (profile: SemanticIndexProfile, chunks: IndexedNoteChunk[]) => Promise<SemanticIndexStatus>;
    search: (queryEmbedding: number[], limit: number) => Promise<SemanticVectorMatch[]>;
}

interface BuildSemanticIndexInput {
    notes: SemanticSearchNoteInput[];
    embeddingClient: EmbeddingClient;
    vectorIndex: SemanticVectorIndex;
    model: string;
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

export const buildSemanticSearchIndex = async ({
    notes,
    embeddingClient,
    vectorIndex,
    model,
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

        onProgress?.({ processedChunks: indexedChunks.length, totalChunks });
    }

    if (!dimensions) {
        throw new Error('Embedding provider returned no vector dimensions.');
    }

    return vectorIndex.replaceAll(
        {
            model,
            dimensions,
            queryInstruction,
            textSchemaVersion: NOTE_EMBEDDING_TEXT_SCHEMA_VERSION,
        },
        indexedChunks,
    );
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
