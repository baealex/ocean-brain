import JSZip from 'jszip';
import { IMPORT_REQUEST_BYTES, importJsonBytes } from './limits';
import { normalizePath, stripCommonImportRoot } from './paths';
import type { ImportFile } from './types';

const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_FILES = 30_000;
const hidden = (path: string) =>
    path.split('/').some((part) => part.startsWith('.') || part === '__MACOSX' || part === 'node_modules');

async function decodeEntry(path: string, bytes: Uint8Array): Promise<ImportFile> {
    return /\.(?:md|csv|svg)$/i.test(path)
        ? { path, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
        : { path, bytes };
}

/** Decode UTF-8 names with JSZip and remove a shared selected-directory wrapper. */
export async function readImportFiles(selected: File[]): Promise<ImportFile[]> {
    const result: ImportFile[] = [];
    let total = 0;
    const add = async (path: string, read: () => Promise<Uint8Array>) => {
        if (result.length >= MAX_FILES) throw new Error('Choose at most 30,000 files per import.');
        if (hidden(path) || normalizePath(path).startsWith('../')) {
            result.push({ path });
            return;
        }
        const bytes = await read();
        total += bytes.byteLength;
        if (total > MAX_TOTAL_BYTES) throw new Error('Choose files smaller than 512 MB in total after unzip.');
        try {
            result.push(await decodeEntry(path, bytes));
        } catch {
            throw new Error(`Cannot read UTF-8 text: ${path}. Save this file as UTF-8 and select it again.`);
        }
    };
    if (selected.length === 1 && /\.zip$/i.test(selected[0].name)) {
        if (selected[0].size > MAX_TOTAL_BYTES) throw new Error('Choose a zip smaller than 512 MB.');
        const zip = await JSZip.loadAsync(await selected[0].arrayBuffer());
        for (const entry of Object.values(zip.files)) {
            if (entry.dir) continue;
            const original = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
            await add(original, () => entry.async('uint8array'));
        }
    } else {
        if (selected.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES)
            throw new Error('Choose files smaller than 512 MB in total.');
        for (const file of selected)
            await add(file.webkitRelativePath || file.name, async () => new Uint8Array(await file.arrayBuffer()));
    }
    return stripCommonImportRoot(result);
}

export function imageDataUrl(bytes: Uint8Array, contentType: string) {
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000)
        chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    return `data:${contentType};base64,${btoa(chunks.join(''))}`;
}

/** Stay below Fastify's 1 MiB limit using actual UTF-8 JSON size, including Korean text. */
export function splitImportBatches<T>(
    items: T[],
    maxCount: number,
    maxBytes = IMPORT_REQUEST_BYTES,
    onOversized?: (item: T) => void,
) {
    const batches: T[][] = [];
    let current: T[] = [];
    let bytes = 0;
    for (const item of items) {
        const size = importJsonBytes(item);
        if (size > maxBytes) {
            if (!onOversized)
                throw new Error('One note exceeds the import request limit. Split it into smaller Markdown files.');
            onOversized(item);
            continue;
        }
        if (current.length && (current.length >= maxCount || bytes + size > maxBytes)) {
            batches.push(current);
            current = [];
            bytes = 0;
        }
        current.push(item);
        bytes += size;
    }
    if (current.length) batches.push(current);
    return batches;
}
