import type { Note, NoteLayout, NoteProperty, NotePropertyOption, NotePropertyValueType } from '~/models/note.model';
import { localError, success } from '../response';
import type { LocalDemoPlugin, LocalTrashNote } from '../types';
import {
    contentPreview,
    createLocalId,
    extractNoteReferences,
    findNote,
    getQueryText,
    isInDateRange,
    listNotesByTags,
    noteMatchesQuery,
    now,
    paginate,
    sortNotes,
} from '../utils';

const toTrashedNotePayload = (note: LocalTrashNote) => ({
    ...note,
    contentPreview: contentPreview(note.content),
    contentAsMarkdown: note.content,
    tagNames: note.tags.map((tag) => tag.name),
});

export const notesLocalPlugin: LocalDemoPlugin = {
    name: 'notes',
    graphHandlers: {
        FetchNotes: ({ state, variables }) => {
            const filtered = sortNotes(
                state.notes.filter((note) => noteMatchesQuery(note, getQueryText(variables))),
                variables,
            );
            return success({ allNotes: { totalCount: filtered.length, notes: paginate(filtered, variables) } });
        },
        FetchTagNotes: ({ state, variables }) => {
            const filtered = state.notes.filter(
                (note) => note.tags.length > 0 && noteMatchesQuery(note, getQueryText(variables)),
            );
            return success({ tagNotes: { totalCount: filtered.length, notes: paginate(filtered, variables) } });
        },
        FetchNotesByTagNames: ({ state, variables }) => {
            const filtered = listNotesByTags(
                state,
                (variables.tagNames as string[] | undefined) ?? [],
                (variables.mode as 'and' | 'or' | undefined) ?? 'and',
            );
            return success({ notesByTagNames: { totalCount: filtered.length, notes: paginate(filtered, variables) } });
        },
        FetchNote: ({ state, variables }) => {
            const note = findNote(state, variables.id);
            return note ? success({ note }) : localError('Note not found');
        },
        FetchPinnedNotes: ({ state }) => {
            const pinnedNotes = state.notes
                .filter((note) => note.pinned)
                .sort((a, b) => a.order - b.order)
                .map(({ id, title, order }) => ({ id, title, order }));
            return success({ pinnedNotes });
        },
        CreateNote: ({ state, variables, save }) => {
            const input = variables.note as { title?: string; content?: string; layout?: NoteLayout };
            const timestamp = now();
            const note: Note = {
                id: createLocalId('note'),
                title: input.title ?? '',
                content: input.content ?? '',
                pinned: false,
                order: state.notes.length,
                layout: input.layout ?? 'wide',
                tags: [],
                properties: [],
                createdAt: timestamp,
                updatedAt: timestamp,
            };
            state.notes.unshift(note);
            save();
            return success({ createNote: { id: note.id } });
        },
        UpdateNote: ({ state, variables, save }) => {
            const note = findNote(state, variables.id);
            if (!note) return localError('Note not found');

            const input = variables.note as Partial<Pick<Note, 'title' | 'content' | 'layout'>>;
            Object.assign(note, input, { updatedAt: now() });
            save();
            return success({ updateNote: { id: note.id, title: note.title, updatedAt: note.updatedAt } });
        },
        PinNote: ({ state, variables, save }) => {
            const note = findNote(state, variables.id);
            if (!note) return localError('Note not found');

            note.pinned = Boolean(variables.pinned);
            note.updatedAt = now();
            save();
            return success({ pinNote: note });
        },
        DeleteNote: ({ state, variables, save }) => {
            const index = state.notes.findIndex((note) => note.id === String(variables.id));
            if (index >= 0) state.trashedNotes.unshift({ ...state.notes.splice(index, 1)[0], deletedAt: now() });
            save();
            return success({ deleteNote: true });
        },
        ReorderNotes: ({ state, variables, save }) => {
            const orders = variables.notes as Array<{ id: string; order: number }>;
            for (const order of orders) {
                const note = findNote(state, order.id);
                if (note) note.order = order.order;
            }
            save();
            return success({ reorderNotes: orders });
        },
        FetchBackReferences: ({ state, variables }) => {
            const targetId = String(variables.id);
            const backReferences = state.notes
                .filter((note) => note.id !== targetId)
                .filter((note) => extractNoteReferences(note).some((reference) => reference.id === targetId))
                .map(({ id, title }) => ({ id, title }));
            return success({ backReferences });
        },
        FetchImageNotes: () => success({ imageNotes: [] }),
        FetchNoteSnapshots: () => success({ noteSnapshots: [] }),
        FetchNoteSnapshot: () => success({ noteSnapshot: null }),
        FetchNoteSnapshotDiff: () => success({ noteSnapshotDiff: null }),
        RestoreNoteSnapshot: () => localError('Snapshots are not available in local-only demo mode'),
        FetchTrashedNotes: ({ state, variables }) => {
            const notes = state.trashedNotes.map(toTrashedNotePayload);
            return success({ trashedNotes: { totalCount: notes.length, notes: paginate(notes, variables) } });
        },
        FetchTrashedNote: ({ state, variables }) => {
            const note = state.trashedNotes.find((item) => item.id === String(variables.id));
            return success({ trashedNote: note ? toTrashedNotePayload(note) : null });
        },
        RestoreTrashedNote: ({ state, variables, save }) => {
            const index = state.trashedNotes.findIndex((note) => note.id === String(variables.id));
            if (index < 0) return localError('Trashed note not found');

            const { deletedAt: _deletedAt, ...note } = state.trashedNotes.splice(index, 1)[0];
            note.updatedAt = now();
            state.notes.unshift(note);
            save();
            return success({ restoreTrashedNote: note });
        },
        PurgeTrashedNote: ({ state, variables, save }) => {
            state.trashedNotes = state.trashedNotes.filter((note) => note.id !== String(variables.id));
            save();
            return success({ purgeTrashedNote: true });
        },
        FetchNoteGraph: ({ state }) => {
            const noteIds = new Set(state.notes.map((note) => note.id));
            const seenLinks = new Set<string>();
            const links = state.notes.flatMap((note) =>
                extractNoteReferences(note)
                    .filter((reference) => noteIds.has(reference.id) && reference.id !== note.id)
                    .flatMap((reference) => {
                        const key = [note.id, reference.id].sort().join(':');
                        if (seenLinks.has(key)) return [];

                        seenLinks.add(key);
                        return [{ source: note.id, target: reference.id }];
                    }),
            );
            const connectionCounts = new Map<string, number>();
            links.forEach((link) => {
                connectionCounts.set(link.source, (connectionCounts.get(link.source) ?? 0) + 1);
                connectionCounts.set(link.target, (connectionCounts.get(link.target) ?? 0) + 1);
            });
            const nodes = state.notes.map((note) => ({
                id: note.id,
                title: note.title,
                connections: connectionCounts.get(note.id) ?? 0,
            }));
            return success({ noteGraph: { nodes, links } });
        },
        FetchNotePropertyKeys: ({ state, variables }) => {
            const keys = state.propertyDefinitions.map((definition) => ({
                ...definition,
                noteCount: state.notes.filter((note) =>
                    note.properties?.some((property) => property.key === definition.key),
                ).length,
            }));
            return success({
                notePropertyKeys: {
                    totalCount: keys.length,
                    keys: paginate(keys, variables, { limit: 50, offset: 0 }),
                },
            });
        },
        CreateNotePropertyKey: ({ state, variables, save }) => {
            const input = variables.input as {
                key: string;
                name?: string;
                valueType: NotePropertyValueType;
                options?: NotePropertyOption[];
            };
            const definition = {
                key: input.key,
                name: input.name ?? input.key,
                valueType: input.valueType,
                options: input.options ?? [],
                updatedAt: now(),
            };
            state.propertyDefinitions.push(definition);
            save();
            return success({ createNotePropertyKey: { ...definition, noteCount: 0 } });
        },
        UpdateNotePropertyKey: ({ state, variables, save }) => {
            const definition = state.propertyDefinitions.find((item) => item.key === String(variables.key));
            if (!definition) return localError('Property key not found');

            const input = variables.input as { name?: string; options?: NotePropertyOption[] };
            if (input.name) definition.name = input.name;
            if (input.options) definition.options = input.options;
            definition.updatedAt = now();
            save();
            return success({ updateNotePropertyKey: { ...definition, noteCount: 0 } });
        },
        DeleteNotePropertyKey: ({ state, variables, save }) => {
            const key = String(variables.key);
            state.propertyDefinitions = state.propertyDefinitions.filter((item) => item.key !== key);
            for (const note of state.notes)
                note.properties = note.properties?.filter((property) => property.key !== key);
            save();
            return success({
                deleteNotePropertyKey: { key, name: key, valueType: 'text', affectedNoteCount: 0, deleted: true },
            });
        },
        UpdateNoteProperties: ({ state, variables, save }) => {
            const note = findNote(state, variables.id);
            if (!note) return localError('Note not found');

            const patch = variables.patch as {
                set?: Array<Omit<NoteProperty, 'createdAt' | 'updatedAt'>>;
                deleteKeys?: string[];
            };
            const timestamp = now();
            const deleteKeys = new Set(patch.deleteKeys ?? []);
            const current = (note.properties ?? []).filter((property) => !deleteKeys.has(property.key));

            for (const item of patch.set ?? []) {
                const index = current.findIndex((property) => property.key === item.key);
                const definition = state.propertyDefinitions.find((definition) => definition.key === item.key);
                const property: NoteProperty = {
                    ...item,
                    name: item.name ?? definition?.name ?? item.key,
                    valueType: item.valueType ?? definition?.valueType ?? 'text',
                    option: item.option ?? definition?.options.find((option) => option.value === item.value) ?? null,
                    createdAt: current[index]?.createdAt ?? timestamp,
                    updatedAt: timestamp,
                };
                if (index >= 0) current[index] = property;
                else current.push(property);
            }

            note.properties = current;
            note.updatedAt = timestamp;
            save();
            return success({
                updateNoteProperties: { id: note.id, updatedAt: note.updatedAt, properties: note.properties },
            });
        },
        NotesInDateRange: ({ state, variables }) => {
            const dateRange = variables.dateRange as { start?: string; end?: string } | undefined;
            const notes = state.notes.filter((note) => isInDateRange(note.createdAt, dateRange));
            return success({ notesInDateRange: notes });
        },
    },
};
