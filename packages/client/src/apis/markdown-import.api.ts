import axios from 'axios';
import type { PropertyType } from '~/modules/markdown-import';

export interface ImportDefinition {
    key: string;
    name: string;
    valueType: PropertyType;
    options: Array<{ value: string; label: string }>;
}
export interface ImportContext {
    batchSize: number;
    definitions: ImportDefinition[];
    titles: Array<{ title: string; count: number }>;
    tags: string[];
}
export interface ImportMapping {
    source: string;
    mode: 'existing' | 'new';
    key?: string;
    name?: string;
    valueType?: PropertyType;
    options?: string[];
}
export interface ImportBatchResult {
    notes: Array<{ path: string; id: string }>;
    errors: Array<{ path: string; message: string }>;
}
export interface ImportSaveResult {
    saved: string[];
    errors: Array<{ path: string; message: string }>;
}
export const fetchImportContext = async (workspaceId: string) =>
    (await axios.get<ImportContext>('/api/markdown-import/context', { params: { workspaceId } })).data;
export const startMarkdownImport = async (workspaceId: string, mappings: ImportMapping[]) =>
    (
        await axios.post<{
            token: string;
            mappings: Array<{ source: string; key: string; valueType: PropertyType }>;
            batchSize: number;
        }>('/api/markdown-import/start', { workspaceId, mappings })
    ).data;
export const createImportNotes = async (
    token: string,
    notes: Array<{ path: string; title: string; createdAt?: string; updatedAt?: string }>,
) => (await axios.post<ImportBatchResult>('/api/markdown-import/create', { token, notes })).data;
export const saveImportNotes = async (
    token: string,
    notes: Array<{ path: string; markdown: string; properties?: Record<string, string> }>,
) => (await axios.post<ImportSaveResult>('/api/markdown-import/save', { token, notes })).data;
export const trashImportedNotes = async (token: string) =>
    (
        await axios.post<{ trashed: number; errors: Array<{ path: string; message: string }> }>(
            '/api/markdown-import/trash',
            { token },
        )
    ).data;
