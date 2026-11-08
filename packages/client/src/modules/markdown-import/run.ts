import axios from 'axios';
import { uploadImage } from '~/apis/image-upload-adapter';
import {
    createImportNotes,
    type ImportMapping,
    saveImportNotes,
    startMarkdownImport,
} from '~/apis/markdown-import.api';
import { imageDataUrl, splitImportBatches } from './files';
import { createImportIndex, createImportIndexTitle, renderImportMarkdown } from './index';
import { IMPORT_MARKDOWN_CHARS, IMPORT_REQUEST_BYTES } from './limits';
import { normalizePropertyValue } from './metadata';
import { retryImportRequest } from './retry';
import type { ImportIssue, ImportPlan, SyntaxCount } from './types';

export interface ImportResult {
    token: string;
    ids: Record<string, string>;
    saved: number;
    indexId?: string;
    issues: ImportIssue[];
    workspaceId: string;
    trashed?: number;
    syntax?: Record<string, SyntaxCount>;
    recoverySummary?: boolean;
    createdCount?: number;
    issueCounts?: Record<string, number>;
}
const errorMessage = (error: unknown) =>
    axios.isAxiosError<{ message?: string }>(error)
        ? (error.response?.data?.message ?? error.message)
        : error instanceof Error
          ? error.message
          : String(error);

export async function runMarkdownImport({
    plan,
    sourceName = 'Markdown',
    workspaceId,
    mappings,
    onProgress,
    onCheckpoint,
    cancelled,
}: {
    plan: ImportPlan;
    sourceName?: string;
    workspaceId: string;
    mappings: ImportMapping[];
    onProgress: (label: string, done: number, total: number) => void;
    onCheckpoint: (result: ImportResult) => void;
    cancelled: () => boolean;
}): Promise<ImportResult> {
    const check = () => {
        if (cancelled()) throw new Error('Import cancelled. Created notes can be moved to trash below.');
    };
    const wait = async (milliseconds: number) => {
        for (let elapsed = 0; elapsed < milliseconds; elapsed += 500) {
            check();
            await new Promise((resolve) => setTimeout(resolve, Math.min(500, milliseconds - elapsed)));
        }
        check();
    };
    let requests = 0;
    let windowStarted = Date.now();
    const throttle = async () => {
        check();
        if (requests >= 200 && Date.now() - windowStarted < 60_000) {
            onProgress('Waiting for the next import batch', 0, 1);
            await wait(60_000 - (Date.now() - windowStarted));
        }
        if (Date.now() - windowStarted >= 60_000) {
            requests = 0;
            windowStarted = Date.now();
        }
        requests++;
    };
    const request = <T>(operation: () => Promise<T>) =>
        retryImportRequest(
            async () => {
                await throttle();
                return operation();
            },
            wait,
            () => onProgress('Request limit reached. Retrying import…', 0, 1),
        );
    const session = await request(() => startMarkdownImport(workspaceId, mappings));
    const result: ImportResult = {
        token: session.token,
        ids: {},
        saved: 0,
        issues: [...plan.issues],
        workspaceId,
        syntax: plan.syntax,
    };
    const imageUrls: Record<string, string> = Object.create(null);
    const failedCreates = new Set<string>();
    const savedPaths = new Set<string>();
    const failedSaves = new Set<string>();
    const checkpoint = () => onCheckpoint({ ...result, ids: { ...result.ids }, issues: [...result.issues] });
    const addErrors = (kind: string, errors: Array<{ path: string; message: string }>) => {
        for (const error of errors)
            result.issues.push({ kind, path: error.path, value: error.path, reason: error.message });
    };
    checkpoint();
    try {
        const metadata = [
            ...plan.notes.map(({ path, title, createdAt, updatedAt }) => ({ path, title, createdAt, updatedAt })),
            { path: '__ocean_brain_import_index__', title: createImportIndexTitle(sourceName) },
        ];
        let created = 0;
        for (const notes of splitImportBatches(metadata, session.batchSize)) {
            const response = await request(() => createImportNotes(session.token, notes));
            for (const note of response.notes) result.ids[note.path] = note.id;
            for (const error of response.errors) failedCreates.add(error.path);
            addErrors('note-create-failed', response.errors);
            created += response.notes.length;
            onProgress('Creating notes', created, metadata.length);
            checkpoint();
        }
        result.indexId = result.ids.__ocean_brain_import_index__;
        for (let index = 0; index < plan.assets.length; index++) {
            check();
            const asset = plan.assets[index];
            const file = plan.files.find((file) => file.path === asset.path);
            if (!file?.bytes) {
                result.issues.push({
                    kind: 'image-upload-failed',
                    path: asset.path,
                    value: asset.path,
                    reason: 'Image bytes are missing.',
                });
                continue;
            }
            try {
                const base64 = imageDataUrl(file.bytes, asset.contentType);
                imageUrls[asset.path] = await request(() => uploadImage({ base64 }));
            } catch (error) {
                result.issues.push({
                    kind: 'image-upload-failed',
                    path: asset.path,
                    value: asset.path,
                    reason: errorMessage(error),
                });
            }
            onProgress('Uploading images', index + 1, plan.assets.length);
            checkpoint();
        }
        const bodies: Array<{ path: string; markdown: string; properties: Record<string, string> }> = [];
        const mappingTypes = new Map(session.mappings.map((mapping) => [mapping.source, mapping.valueType]));
        for (const note of plan.notes) {
            if (!result.ids[note.path]) continue;
            let markdown = note.markdown;
            // A failed destination creation must not silently turn another note into a failed save.
            for (const link of plan.links.filter((link) => link.from === note.path && failedCreates.has(link.to))) {
                const url = `ocean-import-note:${encodeURIComponent(link.to)}`;
                markdown = markdown.split(url).join(`unimported:${encodeURIComponent(link.to)}`);
                result.issues.push({
                    kind: 'link-target-create-failed',
                    path: note.path,
                    value: link.to,
                    reason: 'Destination note creation failed; label retained.',
                });
            }
            bodies.push({
                path: note.path,
                markdown: renderImportMarkdown({ ...note, markdown }, result.ids, imageUrls),
                properties: Object.fromEntries(
                    Object.entries(note.properties).flatMap(([source, value]) => {
                        const type = mappingTypes.get(source);
                        return type ? [[source, normalizePropertyValue(value, type)]] : [];
                    }),
                ),
            });
        }
        if (result.indexId)
            bodies.push({
                path: '__ocean_brain_import_index__',
                markdown: createImportIndex(
                    plan.notes.filter((note) => result.ids[note.path]),
                    result.ids,
                ),
                properties: {},
            });
        let processed = 0;
        const rejectBody = (note: (typeof bodies)[number]) => {
            failedSaves.add(note.path);
            result.issues.push({
                kind: 'note-save-failed',
                path: note.path,
                value: note.path,
                reason: 'Rendered note exceeds the per-note request limit. Other notes continue importing.',
            });
        };
        const validBodies = bodies.filter((note) => {
            if (note.markdown.length <= IMPORT_MARKDOWN_CHARS) return true;
            rejectBody(note);
            return false;
        });
        for (const notes of splitImportBatches(validBodies, session.batchSize, IMPORT_REQUEST_BYTES, rejectBody)) {
            const response = await request(() => saveImportNotes(session.token, notes));
            result.saved += response.saved.filter((path) => path !== '__ocean_brain_import_index__').length;
            for (const path of response.saved) savedPaths.add(path);
            for (const error of response.errors) failedSaves.add(error.path);
            addErrors('note-save-failed', response.errors);
            processed += notes.length;
            onProgress('Saving contents and backlinks', processed, bodies.length);
            checkpoint();
        }
    } catch (error) {
        result.issues.push({ kind: 'import-interrupted', path: '', value: 'Import', reason: errorMessage(error) });
        for (const note of plan.notes.filter((note) => !result.ids[note.path] && !failedCreates.has(note.path)))
            result.issues.push({
                kind: 'note-not-created',
                path: note.path,
                value: note.title,
                reason: 'Import interrupted before creation.',
            });
    }
    for (const note of plan.notes) {
        if (result.ids[note.path] && !savedPaths.has(note.path) && !failedSaves.has(note.path))
            result.issues.push({
                kind: 'note-content-not-saved',
                path: note.path,
                value: note.title,
                reason: 'Import interrupted before saving this created note. It remains available for trash-all.',
            });
    }
    checkpoint();
    return result;
}
