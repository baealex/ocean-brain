import type { Note, NoteLayout, NoteProperty, NotePropertyOption, NotePropertyValueType } from '~/models/note.model';
import type { View } from '~/models/view.model';
import { localBackReferenceContexts } from '../back-reference-context';
import { localError, success } from '../response';
import type { LocalDemoPlugin, LocalDemoState, LocalTrashNote } from '../types';
import {
    contentAsBlockLines,
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
    toIsoTimestamp,
    trashedContentPreview,
    withContentPreview,
} from '../utils';
import { localScopedNotes, localScopeId, localWorkspace } from '../workspace';

const toTrashedNotePayload = (note: LocalTrashNote) => ({
    ...note,
    createdAt: toIsoTimestamp(note.createdAt),
    updatedAt: toIsoTimestamp(note.updatedAt),
    deletedAt: toIsoTimestamp(note.deletedAt),
    contentPreview: trashedContentPreview(note.content),
    contentAsMarkdown: contentAsBlockLines(note.content),
    tagNames: note.tags.map((tag) => tag.name),
});

const viewReferencesProperty = (view: View, key: string) => {
    if (view.propertyFilters.some((filter) => filter.key === key)) {
        return true;
    }

    if (view.displayType === 'table') {
        return view.displayOptions.tablePropertyKeys.includes(key);
    }

    if (view.displayType === 'board') {
        return view.displayOptions.boardGroupByPropertyKey === key;
    }

    return view.displayType === 'calendar' && view.displayOptions.calendarDatePropertyKey === key;
};

const syncLocalSelectOptionReferences = (
    state: LocalDemoState,
    key: string,
    options: NotePropertyOption[],
    renamedValues: Map<string, string>,
) => {
    const optionByValue = new Map(options.map((option) => [option.value, option]));

    for (const note of [...state.notes, ...state.trashedNotes]) {
        note.properties = note.properties?.map((property) => {
            if (property.key !== key || property.valueType !== 'select') {
                return property;
            }

            const value = renamedValues.get(property.value) ?? property.value;
            return { ...property, value, option: optionByValue.get(value) ?? property.option };
        });
    }

    if (renamedValues.size === 0) {
        return;
    }

    for (const view of state.viewWorkspace.groups.flatMap((group) => group.views)) {
        view.propertyFilters = view.propertyFilters.map((filter) => {
            const nextValue =
                filter.key === key && filter.valueType === 'select' && filter.value
                    ? renamedValues.get(filter.value)
                    : undefined;
            return nextValue === undefined ? filter : { ...filter, value: nextValue };
        });
    }
};

export const notesLocalPlugin: LocalDemoPlugin = {
    name: 'notes',
    graphHandlers: {
        FetchNotes: ({ state, variables }) => {
            const filtered = sortNotes(
                localScopedNotes(state, variables).filter((note) => noteMatchesQuery(note, getQueryText(variables))),
                variables,
            );
            return success({
                allNotes: { totalCount: filtered.length, notes: withContentPreview(paginate(filtered, variables)) },
            });
        },
        FetchSearchNotes: ({ state, variables }) => {
            const mode = variables.mode as 'HYBRID' | 'LEXICAL' | 'SEMANTIC' | undefined;
            if (mode === 'SEMANTIC') {
                return success({
                    searchNotes: {
                        totalCount: 0,
                        notes: [],
                        matches: [],
                        semanticAvailable: false,
                        semanticUsed: false,
                        semanticError: 'Meaning search is not available in local demo mode.',
                    },
                });
            }

            const filtered = sortNotes(
                localScopedNotes(state, variables).filter((note) => noteMatchesQuery(note, getQueryText(variables))),
                { ...variables, searchFilter: { sortBy: 'updatedAt', sortOrder: 'desc' } },
            );
            const notes = withContentPreview(paginate(filtered, variables));
            return success({
                searchNotes: {
                    totalCount: filtered.length,
                    notes,
                    matches: notes.map((note) => ({ noteId: note.id, lexical: true, semantic: false })),
                    semanticAvailable: false,
                    semanticUsed: false,
                    semanticError: null,
                },
            });
        },
        FetchSearchRelatedNotes: ({ state, variables }) => {
            const noteId = String(variables.noteId);
            const source = findNote(state, noteId);

            if (!source) {
                return success({ searchRelatedNotes: [] });
            }

            const sourceReferences = new Set(extractNoteReferences(source).map((reference) => reference.id));
            const relatedNotes = localScopedNotes(state, variables)
                .filter((note) => note.id !== source.id)
                .map((note) => {
                    const reasons: string[] = [];
                    let score = 0;
                    const noteReferences = new Set(extractNoteReferences(note).map((reference) => reference.id));
                    const sharedTags = note.tags.filter((tag) =>
                        source.tags.some((sourceTag) => sourceTag.id === tag.id),
                    );

                    if (sourceReferences.has(note.id)) {
                        reasons.push('Linked from this note');
                        score += 100;
                    }

                    if (noteReferences.has(source.id)) {
                        reasons.push('Backlink to this note');
                        score += 100;
                    }

                    for (const tag of sharedTags) {
                        reasons.push(`Shares ${tag.name}`);
                        score += 20;
                    }

                    return { note, reasons, score };
                })
                .filter(({ reasons }) => reasons.length > 0)
                .sort(
                    (left, right) =>
                        right.score - left.score || right.note.updatedAt.localeCompare(left.note.updatedAt),
                )
                .slice(0, 5)
                .map(({ note, reasons }) => ({ id: note.id, title: note.title || 'Untitled', reasons }));

            return success({ searchRelatedNotes: relatedNotes });
        },
        FetchTagNotes: ({ state, variables }) => {
            const tagId = getQueryText(variables);
            const filtered = sortNotes(
                localScopedNotes(state, variables).filter((note) =>
                    note.tags.some((tag) => tag.id.toLowerCase() === tagId),
                ),
                { ...variables, searchFilter: { sortBy: 'updatedAt', sortOrder: 'desc' } },
            );
            return success({
                tagNotes: { totalCount: filtered.length, notes: withContentPreview(paginate(filtered, variables)) },
            });
        },
        FetchNotesByTagNames: ({ state, variables }) => {
            const filtered = listNotesByTags(
                { ...state, notes: localScopedNotes(state, variables) },
                (variables.tagNames as string[] | undefined) ?? [],
                (variables.mode as 'and' | 'or' | undefined) ?? 'and',
            );
            return success({
                notesByTagNames: {
                    totalCount: filtered.length,
                    notes: withContentPreview(paginate(filtered, variables)),
                },
            });
        },
        FetchNote: ({ state, variables }) => {
            const note = findNote(state, variables.id);
            return note
                ? success({ note: { ...note, workspaceId: note.workspaceId ?? '1' } })
                : localError('Note not found');
        },
        FetchPinnedNotes: ({ state, variables }) => {
            const pinnedNotes = localScopedNotes(state, variables)
                .filter((note) => note.pinned)
                .sort((a, b) => a.order - b.order)
                .map(({ id, title, order }) => ({ id, title, order }));
            return success({ pinnedNotes });
        },
        CreateNote: ({ state, variables, save }) => {
            const input = variables.note as {
                workspaceId?: string;
                title?: string;
                content?: string;
                layout?: NoteLayout;
            };
            const workspaceId = localWorkspace(state, input.workspaceId ?? '1', true);
            const timestamp = now();
            const note: Note = {
                workspaceId,
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
            return success({
                createNote: {
                    id: note.id,
                    workspaceId,
                    title: note.title,
                    createdAt: note.createdAt,
                    updatedAt: note.updatedAt,
                },
            });
        },
        UpdateNote: ({ state, variables, save }) => {
            const note = findNote(state, variables.id);
            if (!note) return localError('Note not found');
            localWorkspace(state, note.workspaceId ?? '1', true);

            const input = variables.note as Partial<Pick<Note, 'title' | 'content' | 'layout'>>;
            Object.assign(note, input, { updatedAt: now() });
            save();
            return success({ updateNote: { id: note.id, title: note.title, updatedAt: note.updatedAt } });
        },
        PinNote: ({ state, variables, save }) => {
            const note = findNote(state, variables.id);
            if (!note) return localError('Note not found');
            localWorkspace(state, note.workspaceId ?? '1', true);

            note.pinned = Boolean(variables.pinned);
            note.updatedAt = now();
            save();
            return success({ pinNote: note });
        },
        DeleteNote: ({ state, variables, save }) => {
            const index = state.notes.findIndex((note) => note.id === String(variables.id));
            if (index >= 0) localWorkspace(state, state.notes[index].workspaceId ?? '1', true);
            if (index >= 0) state.trashedNotes.unshift({ ...state.notes.splice(index, 1)[0], deletedAt: now() });
            save();
            return success({ deleteNote: true });
        },
        ReorderNotes: ({ state, variables, save }) => {
            const orders = variables.notes as Array<{ id: string; order: number }>;
            for (const order of orders) {
                const note = findNote(state, order.id);
                if (note) localWorkspace(state, note.workspaceId ?? '1', true);
            }
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
        FetchBackReferenceDetails: ({ state, variables }) => {
            const targetId = String(variables.id);
            const offset = Math.max(0, Number(variables.offset) || 0);
            const limit = Math.min(50, Math.max(1, Number(variables.limit) || 20));
            const notes = state.notes.filter(
                (note) =>
                    note.id !== targetId && extractNoteReferences(note).some((reference) => reference.id === targetId),
            );
            const references = sortNotes(notes, { sortBy: 'updatedAt', sortOrder: 'desc', pinnedFirst: true })
                .slice(offset, offset + limit)
                .map((note) => ({
                    id: note.id,
                    title: note.title,
                    ...localBackReferenceContexts(note.content, targetId),
                }));
            const hasMore = offset + limit < notes.length;
            return success({
                backReferenceDetails: { references, hasMore, nextOffset: hasMore ? offset + limit : null },
            });
        },
        FetchImageNotes: () => success({ imageNotes: [] }),
        FetchNoteSnapshots: () => success({ noteSnapshots: [] }),
        FetchNoteSnapshot: () => success({ noteSnapshot: null }),
        FetchNoteSnapshotDiff: () => success({ noteSnapshotDiff: null }),
        RestoreNoteSnapshot: () => localError('Snapshots are not available in local-only demo mode'),
        FetchTrashedNotes: ({ state, variables }) => {
            const workspaceId = localScopeId(state, variables);
            const notes = state.trashedNotes
                .filter((note) => workspaceId === null || (note.workspaceId ?? '1') === workspaceId)
                .map(toTrashedNotePayload);
            return success({ trashedNotes: { totalCount: notes.length, notes: paginate(notes, variables) } });
        },
        FetchTrashedNote: ({ state, variables }) => {
            const note = state.trashedNotes.find((item) => item.id === String(variables.id));
            return success({ trashedNote: note ? toTrashedNotePayload(note) : null });
        },
        RestoreTrashedNote: ({ state, variables, save }) => {
            const index = state.trashedNotes.findIndex((note) => note.id === String(variables.id));
            if (index < 0) return localError('Trashed note not found');

            localWorkspace(state, state.trashedNotes[index].workspaceId ?? '1', true);
            const { deletedAt: _deletedAt, ...note } = state.trashedNotes.splice(index, 1)[0];
            note.updatedAt = now();
            state.notes.unshift(note);
            save();
            return success({ restoreTrashedNote: note });
        },
        PurgeTrashedNote: ({ state, variables, save }) => {
            const original = state.trashedNotes.find((note) => note.id === String(variables.id));
            if (original) localWorkspace(state, original.workspaceId ?? '1', true);
            state.trashedNotes = state.trashedNotes.filter((note) => note.id !== String(variables.id));
            save();
            return success({ purgeTrashedNote: true });
        },
        FetchNoteGraph: ({ state, variables }) => {
            const noteIds = new Set(localScopedNotes(state, variables).map((note) => note.id));
            const seenLinks = new Set<string>();
            const links = localScopedNotes(state, variables).flatMap((note) =>
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
            const nodes = localScopedNotes(state, variables).map((note) => ({
                id: note.id,
                title: note.title,
                connections: connectionCounts.get(note.id) ?? 0,
                updatedAt: note.updatedAt,
                tags: note.tags,
            }));
            return success({ noteGraph: { nodes, links } });
        },
        FetchNotePropertyKeys: ({ state, variables }) => {
            const workspaceId = localScopeId(state, variables);
            const keys = state.propertyDefinitions
                .filter((definition) => workspaceId === null || (definition.workspaceId ?? '1') === workspaceId)
                .map((definition) => ({
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
                key?: string;
                workspaceId?: string;
                name?: string;
                valueType: NotePropertyValueType;
                options?: NotePropertyOption[];
            };
            const workspaceId = localWorkspace(state, input.workspaceId ?? '1', true);
            const key = input.key ?? createLocalId('field');
            if (state.propertyDefinitions.some((definition) => definition.key === key))
                return localError('This field key already exists.');
            const definition = {
                workspaceId,
                key,
                name: input.name ?? key,
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
            localWorkspace(state, definition.workspaceId ?? '1', true);

            const input = variables.input as { name?: string; options?: NotePropertyOption[] };
            if (input.name) definition.name = input.name;
            if (input.options) {
                const previousOptionById = new Map(definition.options.map((option) => [option.id, option]));
                const renamedValues = new Map(
                    input.options.flatMap((option) => {
                        const previous = option.id ? previousOptionById.get(option.id) : undefined;
                        return previous && previous.value !== option.value ? [[previous.value, option.value]] : [];
                    }),
                );
                definition.options = input.options;
                syncLocalSelectOptionReferences(state, definition.key, input.options, renamedValues);
            }
            definition.updatedAt = now();
            save();
            return success({ updateNotePropertyKey: { ...definition, noteCount: 0 } });
        },
        DeleteNotePropertyKey: ({ state, variables, save }) => {
            const key = String(variables.key);
            const definition = state.propertyDefinitions.find((item) => item.key === key);
            if (definition) localWorkspace(state, definition.workspaceId ?? '1', true);
            const referencingView = state.viewWorkspace.groups
                .flatMap((group) => group.views)
                .find((view) => viewReferencesProperty(view, key));

            if (referencingView) {
                return localError(`Property ${key} is used by view ${referencingView.title} and cannot be deleted.`);
            }

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
            localWorkspace(state, note.workspaceId ?? '1', true);

            const patch = variables.patch as {
                set?: Array<Omit<NoteProperty, 'createdAt' | 'updatedAt'>>;
                deleteKeys?: string[];
            };
            for (const item of patch.set ?? []) {
                const definition = state.propertyDefinitions.find((definition) => definition.key === item.key);
                if (!definition || (definition.workspaceId ?? '1') !== (note.workspaceId ?? '1'))
                    return localError('Choose a field from this note’s workspace.');
            }
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
            const notes = localScopedNotes(state, variables).filter(
                (note) => isInDateRange(note.createdAt, dateRange) || isInDateRange(note.updatedAt, dateRange),
            );
            return success({ notesInDateRange: notes });
        },
    },
};
