import { randomUUID } from 'node:crypto';
import { emitNoteChange } from '~/features/note/services/change-events.js';
import { createNoteWithContent } from '~/features/note/services/create.js';
import { replaceNoteReferences } from '~/features/note/services/note-reference-index.js';
import {
    createNotePropertyDefinition,
    type NotePropertySetInput,
    setNotePropertyValues,
    validateNotePropertiesPatchValues,
} from '~/features/note/services/properties.js';
import { buildNoteSearchProjection } from '~/features/note/services/search.js';
import { trashNoteById } from '~/features/note/services/trash.js';
import { parseWorkspaceId, requireWorkspace } from '~/features/workspace/scope.js';
import models, { type PropertyValueType } from '~/models.js';
import { extractTagIdsFromContentJson } from '~/modules/blocknote.js';
import { AppError } from '~/modules/error-handler.js';
import { importMarkdownToBlocksJson } from './markdown.js';

export const IMPORT_BATCH_SIZE = 25;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IMPORT_NOTES = 20_000;
const invalid = (message: string): never => {
    throw new AppError(400, 'INVALID_MARKDOWN_IMPORT', message);
};
const record = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('Expected an object.');
    return value as Record<string, unknown>;
};
const string = (value: unknown, name: string, max = 2048) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) return invalid(`Invalid ${name}.`);
    return value;
};
const timestamp = (value: unknown) => {
    if (value === undefined) return undefined;
    const text = string(value, 'timestamp', 64);
    const date = new Date(text);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || !Number.isFinite(date.getTime())) return invalid('Invalid timestamp.');
    return date;
};
const batch = (value: unknown) => {
    if (!Array.isArray(value) || !value.length || value.length > IMPORT_BATCH_SIZE)
        return invalid(`Send 1–${IMPORT_BATCH_SIZE} notes per batch.`);
    return value.map(record);
};
const valueTypes = new Set(['text', 'url', 'number', 'date', 'boolean', 'select']);
interface Mapping {
    source: string;
    key: string;
    valueType: PropertyValueType;
    values?: Record<string, string>;
}
interface ImportedNote {
    id: number;
    path: string;
    title: string;
    createdAt?: Date;
    updatedAt?: Date;
    saved: boolean;
}
interface ImportSession {
    workspaceId: number;
    expiresAt: number;
    notes: Map<string, ImportedNote>;
    mappings: Mapping[];
    busy: boolean;
    trashed: boolean;
}

export function createMarkdownImportService() {
    const sessions = new Map<string, ImportSession>();
    const get = async (token: unknown) => {
        const session = sessions.get(string(token, 'import token', 100));
        if (!session || session.expiresAt < Date.now())
            throw new AppError(
                410,
                'IMPORT_EXPIRED',
                'This import session expired. Imported notes remain available in the workspace.',
            );
        await requireWorkspace(session.workspaceId, models, true);
        if (session.trashed) throw new AppError(409, 'IMPORT_TRASHED', 'This import has been moved to trash.');
        return session;
    };
    const locked = async <T>(session: ImportSession, run: () => Promise<T>) => {
        if (session.busy) throw new AppError(409, 'IMPORT_BUSY', 'Wait for the current import batch.');
        session.busy = true;
        try {
            return await run();
        } finally {
            session.busy = false;
        }
    };
    const context = async (workspace: unknown) => {
        const workspaceId = parseWorkspaceId(workspace);
        await requireWorkspace(workspaceId, models, true);
        const [definitions, notes, tags] = await Promise.all([
            models.propertyDefinition.findMany({
                where: { workspaceId },
                include: { options: { orderBy: { order: 'asc' } } },
            }),
            models.note.groupBy({ by: ['title'], where: { workspaceId }, _count: { title: true } }),
            models.tag.findMany({ select: { name: true } }),
        ]);
        return {
            batchSize: IMPORT_BATCH_SIZE,
            definitions: definitions.map((definition) => ({
                key: definition.key,
                name: definition.name,
                valueType: definition.valueType,
                options: definition.options.map((option) => ({ value: option.value, label: option.label })),
            })),
            titles: notes.map((note) => ({ title: note.title, count: note._count.title })),
            tags: tags.map((tag) => tag.name),
        };
    };
    const start = async (input: unknown) => {
        const data = record(input);
        const workspaceId = parseWorkspaceId(data.workspaceId);
        await requireWorkspace(workspaceId, models, true);
        for (const [token, session] of sessions) if (session.expiresAt < Date.now()) sessions.delete(token);
        if (sessions.size >= 50) throw new AppError(429, 'IMPORT_LIMIT', 'Too many active imports. Try again later.');
        if (!Array.isArray(data.mappings) || data.mappings.length > 100)
            return invalid('Expected up to 100 property mappings.');
        const sources = new Set<string>();
        const pending = [];
        for (const raw of data.mappings) {
            const mapping = record(raw);
            const source = string(mapping.source, 'property source', 200);
            if (sources.has(source)) return invalid('Duplicate property source.');
            sources.add(source);
            if (mapping.mode === 'existing') {
                const key = string(mapping.key, 'property key', 200);
                const definition = await models.propertyDefinition.findUnique({
                    where: { key },
                    include: { options: true },
                });
                if (!definition || definition.workspaceId !== workspaceId)
                    return invalid('Property must belong to the target workspace.');
                pending.push({
                    source,
                    existing: definition,
                    valueType: definition.valueType,
                    name: source,
                    options: [] as string[],
                });
            } else if (mapping.mode === 'new') {
                if (typeof mapping.valueType !== 'string' || !valueTypes.has(mapping.valueType))
                    return invalid('Invalid property type.');
                const valueType = mapping.valueType as PropertyValueType;
                const options = mapping.options === undefined ? [] : mapping.options;
                if (
                    !Array.isArray(options) ||
                    options.length > 100 ||
                    options.some((option) => typeof option !== 'string' || !option.trim() || option.length > 200)
                )
                    return invalid('Invalid select options.');
                if (valueType === 'select' && !options.length) return invalid('Select properties need options.');
                pending.push({
                    source,
                    existing: null,
                    valueType,
                    name: string(mapping.name ?? source, 'property name', 200),
                    options: options as string[],
                });
            } else return invalid('Unknown property mapping mode.');
        }
        const mappings: Mapping[] = [];
        for (const mapping of pending) {
            // Let the existing service generate a globally unique key, including cross-workspace collisions.
            const definition =
                mapping.existing ??
                (await createNotePropertyDefinition({
                    workspaceId,
                    name: mapping.name,
                    valueType: mapping.valueType,
                    ...(mapping.valueType === 'select'
                        ? {
                              options: [...new Set(mapping.options)].map((label, index) => ({
                                  value: `option-${index + 1}`,
                                  label,
                              })),
                          }
                        : {}),
                }));
            mappings.push({
                source: mapping.source,
                key: definition.key,
                valueType: definition.valueType,
                ...(definition.valueType === 'select'
                    ? {
                          values: Object.assign(
                              Object.create(null) as Record<string, string>,
                              Object.fromEntries([
                                  ...definition.options.map((option) => [option.value, option.value]),
                                  ...definition.options.map((option) => [option.label, option.value]),
                              ]),
                          ),
                      }
                    : {}),
            });
        }
        const token = randomUUID();
        sessions.set(token, {
            workspaceId,
            expiresAt: Date.now() + SESSION_TTL_MS,
            notes: new Map(),
            mappings,
            busy: false,
            trashed: false,
        });
        return { token, mappings, batchSize: IMPORT_BATCH_SIZE };
    };
    const create = async (input: unknown) => {
        const data = record(input);
        const session = await get(data.token);
        const notes = batch(data.notes).map((note) => ({
            path: string(note.path, 'file path'),
            title: string(note.title, 'title'),
            createdAt: timestamp(note.createdAt),
            updatedAt: timestamp(note.updatedAt),
        }));
        return locked(session, async () => {
            const result: Array<{ path: string; id: string }> = [];
            const errors: Array<{ path: string; message: string }> = [];
            for (const note of notes) {
                try {
                    const previous = session.notes.get(note.path);
                    if (previous) {
                        if (previous.title !== note.title) return invalid('Path reused with a different title.');
                        result.push({ path: note.path, id: String(previous.id) });
                        continue;
                    }
                    if (session.notes.size >= MAX_IMPORT_NOTES)
                        return invalid('Import exceeds 20,000 notes. Choose a smaller folder.');
                    const created = await createNoteWithContent({
                        workspaceId: session.workspaceId,
                        title: note.title,
                        content: '[]',
                    });
                    // Dates are import-only writes; ordinary authoring contracts remain unchanged.
                    const imported = { ...note, id: created.id, saved: false };
                    session.notes.set(note.path, imported);
                    if (note.createdAt || note.updatedAt)
                        await models.note.update({
                            where: { id: created.id },
                            data: {
                                ...(note.createdAt ? { createdAt: note.createdAt } : {}),
                                ...(note.updatedAt ? { updatedAt: note.updatedAt } : {}),
                            },
                        });
                    emitNoteChange({ type: 'note.created', noteId: created.id, workspaceId: session.workspaceId });
                    result.push({ path: note.path, id: String(created.id) });
                } catch (error) {
                    errors.push({ path: note.path, message: error instanceof Error ? error.message : String(error) });
                }
            }
            return { notes: result, errors };
        });
    };
    const save = async (input: unknown) => {
        const data = record(input);
        const session = await get(data.token);
        const notes = batch(data.notes).map((raw) => {
            const path = string(raw.path, 'file path');
            const note = session.notes.get(path);
            if (!note) return invalid('File does not belong to this import.');
            if (typeof raw.markdown !== 'string' || raw.markdown.length > 700_000)
                return invalid('Invalid Markdown body.');
            const rawProperties = raw.properties === undefined ? {} : record(raw.properties);
            const properties: NotePropertySetInput[] = Object.entries(rawProperties).map(([source, value]) => {
                const mapping = session.mappings.find((item) => item.source === source);
                if (!mapping || typeof value !== 'string') return invalid('Unknown or invalid mapped property.');
                return { key: mapping.key, valueType: mapping.valueType, value: mapping.values?.[value] ?? value };
            });
            return { note, markdown: raw.markdown, properties };
        });
        return locked(session, async () => {
            const references = new Map(
                [...session.notes.values()].map((note) => [
                    String(note.id),
                    { id: String(note.id), title: note.title },
                ]),
            );
            const saved: string[] = [];
            const errors: Array<{ path: string; message: string }> = [];
            for (const { note, markdown, properties } of notes) {
                try {
                    const current = await models.note.findUnique({ where: { id: note.id } });
                    if (!current || current.workspaceId !== session.workspaceId)
                        return invalid('Imported note was deleted or moved.');
                    if (note.saved) {
                        saved.push(note.path);
                        continue;
                    }
                    if (properties.length) await validateNotePropertiesPatchValues({ set: properties });
                    const content = await importMarkdownToBlocksJson(markdown, references);
                    const tagIds = extractTagIdsFromContentJson(content).map(Number);
                    await models.$transaction(async (tx) => {
                        await requireWorkspace(session.workspaceId, tx, true);
                        await tx.note.update({
                            where: { id: note.id, workspaceId: session.workspaceId },
                            data: {
                                content,
                                ...buildNoteSearchProjection({ title: note.title, content }),
                                tags: { set: tagIds.map((id) => ({ id })) },
                                ...(note.createdAt ? { createdAt: note.createdAt } : {}),
                                updatedAt: note.updatedAt ?? current.updatedAt,
                            },
                        });
                        if (properties.length) await setNotePropertyValues(tx, note.id, { set: properties });
                        await replaceNoteReferences(tx, note.id, content);
                    });
                    note.saved = true;
                    emitNoteChange({ type: 'note.updated', noteId: note.id, workspaceId: session.workspaceId });
                    saved.push(note.path);
                } catch (error) {
                    errors.push({ path: note.path, message: error instanceof Error ? error.message : String(error) });
                }
            }
            return { saved, errors };
        });
    };
    const trash = async (input: unknown) => {
        const session = await get(record(input).token);
        return locked(session, async () => {
            let trashed = 0;
            const errors: Array<{ path: string; message: string }> = [];
            for (const note of session.notes.values()) {
                try {
                    const current = await models.note.findUnique({
                        where: { id: note.id },
                        select: { workspaceId: true },
                    });
                    if (!current) continue;
                    if (current.workspaceId !== session.workspaceId) {
                        errors.push({ path: note.path, message: 'Note moved to another workspace; left in place.' });
                        continue;
                    }
                    if (await trashNoteById(note.id)) {
                        trashed++;
                        emitNoteChange({ type: 'note.deleted', noteId: note.id, workspaceId: session.workspaceId });
                    }
                } catch (error) {
                    errors.push({ path: note.path, message: error instanceof Error ? error.message : String(error) });
                }
            }
            session.trashed = errors.length === 0;
            return { trashed, errors };
        });
    };
    return { context, start, create, save, trash };
}
