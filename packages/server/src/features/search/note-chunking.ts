import { createHash } from 'node:crypto';
import { extractVisibleSearchTextFromContent } from '~/features/note/services/search.js';

export const NOTE_EMBEDDING_TEXT_SCHEMA_VERSION = 1;
export const DEFAULT_NOTE_CHUNK_MAX_LENGTH = 900;
export const DEFAULT_NOTE_CHUNK_OVERLAP = 120;

export interface SemanticSearchNoteInput {
    id: number;
    title: string;
    content: string;
}

export interface NoteEmbeddingChunk {
    noteId: number;
    chunkIndex: number;
    sourceHash: string;
    text: string;
}

interface NoteChunkingOptions {
    maxLength?: number;
    overlap?: number;
}

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const findWindowEnd = (text: string, start: number, maxLength: number) => {
    const desiredEnd = Math.min(text.length, start + maxLength);
    if (desiredEnd === text.length) {
        return desiredEnd;
    }

    const minimumEnd = start + Math.floor(maxLength * 0.7);
    const breakAt = text.lastIndexOf(' ', desiredEnd);
    return breakAt >= minimumEnd ? breakAt : desiredEnd;
};

const findNextWindowStart = (text: string, start: number, end: number, overlap: number) => {
    const desiredStart = Math.max(start + 1, end - overlap);
    const nextSpace = text.indexOf(' ', desiredStart);

    if (nextSpace === -1 || nextSpace >= end) {
        return desiredStart;
    }

    return nextSpace + 1;
};

export const splitSearchText = (text: string, options: NoteChunkingOptions = {}): string[] => {
    const normalizedText = normalizeText(text);
    if (!normalizedText) {
        return [];
    }

    const maxLength = options.maxLength ?? DEFAULT_NOTE_CHUNK_MAX_LENGTH;
    const overlap = options.overlap ?? DEFAULT_NOTE_CHUNK_OVERLAP;

    if (!Number.isInteger(maxLength) || maxLength < 100) {
        throw new Error('Note chunk maxLength must be an integer of at least 100.');
    }

    if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxLength) {
        throw new Error('Note chunk overlap must be a non-negative integer smaller than maxLength.');
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < normalizedText.length) {
        const end = findWindowEnd(normalizedText, start, maxLength);
        const chunk = normalizedText.slice(start, end).trim();

        if (chunk) {
            chunks.push(chunk);
        }

        if (end >= normalizedText.length) {
            break;
        }

        start = findNextWindowStart(normalizedText, start, end, overlap);
    }

    return chunks;
};

const buildSourceHash = (title: string, body: string) => {
    return createHash('sha256').update(`${NOTE_EMBEDDING_TEXT_SCHEMA_VERSION}\0${title}\0${body}`).digest('hex');
};

export const buildNoteEmbeddingChunks = (
    note: SemanticSearchNoteInput,
    options: NoteChunkingOptions = {},
): NoteEmbeddingChunk[] => {
    const title = normalizeText(note.title);
    const body = normalizeText(extractVisibleSearchTextFromContent(note.content));
    const bodyChunks = splitSearchText(body, options);
    const searchableChunks = bodyChunks.length > 0 ? bodyChunks : title ? [''] : [];
    const sourceHash = buildSourceHash(title, body);

    return searchableChunks.map((chunk, chunkIndex) => ({
        noteId: note.id,
        chunkIndex,
        sourceHash,
        text: title ? `Title: ${title}\nContent: ${chunk}`.trimEnd() : chunk,
    }));
};
