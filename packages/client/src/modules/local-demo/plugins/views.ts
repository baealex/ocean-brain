import type { ViewNoteInput } from '~/apis/view.api';
import type { Note } from '~/models/note.model';
import type { View, ViewNoteCreationContext } from '~/models/view.model';
import { localError, success } from '../response';
import type { LocalDemoPlugin, LocalDemoState } from '../types';
import { applyPropertyFilters, createLocalId, listNotesByTags, now, paginate } from '../utils';

const copyTemplateBody = (value: unknown): unknown => {
    if (Array.isArray(value))
        return value
            .filter((item) => !(item && typeof item === 'object' && 'type' in item && item.type === 'tag'))
            .map(copyTemplateBody);
    if (!value || typeof value !== 'object') return value;
    const copied: Record<string, unknown> = { ...value };
    for (const key of ['content', 'children', 'rows', 'cells']) {
        if (key in copied) copied[key] = copyTemplateBody(copied[key]);
    }
    return copied;
};

const creationContext = (
    state: LocalDemoState,
    viewId: string,
    groupValue?: string | null,
): ViewNoteCreationContext => {
    const view = state.viewWorkspace.groups.flatMap((group) => group.views).find((item) => item.id === viewId);
    if (!view) throw new Error('View not found');
    const template = state.notes.find((note) => note.id === view.defaultTemplateNoteId);
    if (view.defaultTemplateNoteId && !template)
        throw new Error('The default template is unavailable. Choose another template in the view settings.');
    const groupKey = view.displayType === 'board' ? view.displayOptions.boardGroupByPropertyKey : null;
    const dateKey =
        view.displayType === 'calendar' && view.displayOptions.calendarDateField === 'property'
            ? view.displayOptions.calendarDatePropertyKey
            : null;
    const keys = new Set(
        view.propertyFilters.filter((filter) => filter.operator !== 'notExists').map((filter) => filter.key),
    );
    const omittedKeys = new Set(
        view.propertyFilters.filter((filter) => filter.operator === 'notExists').map((filter) => filter.key),
    );
    if (groupKey && groupValue === null) omittedKeys.add(groupKey);
    for (const property of template?.properties ?? []) if (!omittedKeys.has(property.key)) keys.add(property.key);
    if (groupKey && groupValue !== null) keys.add(groupKey);
    if (dateKey) keys.add(dateKey);
    const properties = [...keys].map((key) => {
        const definition = state.propertyDefinitions.find((item) => item.key === key);
        if (!definition) throw new Error(`Property ${key} is unavailable`);
        const filters = view.propertyFilters.filter((filter) => filter.key === key);
        const equalValues = [
            ...new Set(filters.filter((filter) => filter.operator === 'equals').map((filter) => filter.value)),
        ];
        return {
            key,
            name: definition.name,
            valueType: definition.valueType,
            options: definition.options,
            filters,
            required:
                filters.some((filter) => filter.operator !== 'notExists') ||
                key === dateKey ||
                (key === groupKey && groupValue !== undefined),
            defaultValue:
                key === groupKey && groupValue !== undefined
                    ? groupValue
                    : equalValues.length === 1
                      ? (equalValues[0] ?? null)
                      : (template?.properties?.find((property) => property.key === key)?.value ?? null),
        };
    });
    return {
        templateNote: template ? { id: template.id, title: template.title } : null,
        viewId,
        title: view.title,
        tagNames: view.tagNames,
        mode: view.mode,
        defaultTagNames: view.mode === 'and' || view.tagNames.length === 1 ? view.tagNames : [],
        properties,
    };
};

const sortViewNotes = (notes: Note[], view: View, override: Partial<Pick<View, 'sortBy' | 'sortOrder'>> = {}) => {
    const sortBy = override.sortBy ?? view.sortBy;
    const sortOrder = override.sortOrder ?? view.sortOrder;
    const direction = sortOrder === 'asc' ? 1 : -1;

    return [...notes].sort((left, right) => {
        const comparison = left[sortBy].localeCompare(right[sortBy]) * direction;
        return comparison || left.id.localeCompare(right.id);
    });
};

const toTimestamp = (value: string) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : Date.parse(value);
};

export const viewsLocalPlugin: LocalDemoPlugin = {
    name: 'views',
    graphHandlers: {
        ViewNoteCreationContext: ({ state, variables }) => {
            try {
                return success({
                    viewNoteCreationContext: creationContext(
                        state,
                        String(variables.viewId),
                        variables.groupValue as string | null | undefined,
                    ),
                });
            } catch (error) {
                return localError(error instanceof Error ? error.message : 'Unable to load view conditions');
            }
        },
        CreateNoteInView: ({ state, variables, save }) => {
            try {
                const context = creationContext(
                    state,
                    String(variables.viewId),
                    variables.groupValue as string | null | undefined,
                );
                const view = state.viewWorkspace.groups
                    .flatMap((group) => group.views)
                    .find((item) => item.id === context.viewId);
                const input = variables.input as ViewNoteInput;
                if (!view || !input.title.trim()) return localError('A note title is required');
                const template = state.notes.find((note) => note.id === view.defaultTemplateNoteId);
                const templateBlocks: unknown = template ? copyTemplateBody(JSON.parse(template.content || '[]')) : [];
                const timestamp = now();
                const tagNames = [...new Set([...context.defaultTagNames, ...input.tagNames])];
                const tags = tagNames.map(
                    (name) => state.tags.find((tag) => tag.name === name) ?? { id: createLocalId('tag'), name },
                );
                const note: Note = {
                    id: createLocalId('note'),
                    title: input.title.trim(),
                    layout: template?.layout ?? 'wide',
                    pinned: false,
                    order: state.notes.length,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    tags,
                    content: JSON.stringify([
                        {
                            type: 'paragraph',
                            content: tags.map((tag) => ({ type: 'tag', props: { id: tag.id, tag: tag.name } })),
                            children: [],
                        },
                        ...(Array.isArray(templateBlocks) ? templateBlocks : []),
                    ]),
                    properties: context.properties.flatMap((property) => {
                        if (input.deletePropertyKeys?.includes(property.key)) return [];
                        const value =
                            input.properties?.find((item) => item.key === property.key)?.value ?? property.defaultValue;
                        if (value === null || (value === '' && !property.required)) return [];
                        const option = property.options.find((item) => item.value === value) ?? null;
                        if (property.valueType === 'select' && !option)
                            throw new Error(`Choose a valid ${property.name} option`);
                        return [
                            {
                                key: property.key,
                                name: property.name,
                                value,
                                valueType: property.valueType,
                                option,
                                createdAt: timestamp,
                                updatedAt: timestamp,
                            },
                        ];
                    }),
                };
                const matches = applyPropertyFilters(
                    listNotesByTags({ ...state, notes: [note] }, view.tagNames, view.mode),
                    view.propertyFilters,
                );
                const groupKey = view.displayOptions.boardGroupByPropertyKey;
                const groupValue = note.properties?.find((property) => property.key === groupKey)?.value ?? null;
                if (!matches.length || (variables.groupValue !== undefined && variables.groupValue !== groupValue))
                    return localError('The note does not match this view. Check its tags and property values.');
                state.tags.push(...tags.filter((tag) => !state.tags.some((existing) => existing.id === tag.id)));
                state.notes.unshift(note);
                save();
                return success({ createNoteInView: { id: note.id, title: note.title } });
            } catch (error) {
                return localError(error instanceof Error ? error.message : 'Unable to create this note');
            }
        },
        FetchViewWorkspace: ({ state }) => success({ viewWorkspace: state.viewWorkspace }),
        FetchView: ({ state, variables }) => {
            const view = state.viewWorkspace.groups
                .flatMap((group) => group.views)
                .find((item) => item.id === String(variables.id));
            return success({ view: view ?? null });
        },
        FetchViewNotes: ({ state, variables }) => {
            const view = state.viewWorkspace.groups
                .flatMap((group) => group.views)
                .find((item) => item.id === String(variables.id));
            const notes = view
                ? sortViewNotes(
                      applyPropertyFilters(listNotesByTags(state, view.tagNames, view.mode), view.propertyFilters),
                      view,
                      {
                          sortBy: variables.sortBy as View['sortBy'] | undefined,
                          sortOrder: variables.sortOrder as View['sortOrder'] | undefined,
                      },
                  )
                : [];
            return success({ viewNotes: { totalCount: notes.length, notes: paginate(notes, variables) } });
        },
        FetchViewCalendarNotes: ({ state, variables }) => {
            const view = state.viewWorkspace.groups
                .flatMap((group) => group.views)
                .find((item) => item.id === String(variables.id));

            if (!view || view.displayType !== 'calendar') {
                return localError('Calendar view not found');
            }

            const dateRange = variables.dateRange as { start?: unknown; end?: unknown } | undefined;
            const start = Date.parse(String(dateRange?.start ?? ''));
            const end = Date.parse(String(dateRange?.end ?? ''));

            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
                return localError('Calendar date range is invalid');
            }

            const dateField = view.displayOptions.calendarDateField;
            const datePropertyKey = view.displayOptions.calendarDatePropertyKey;

            if (
                dateField === 'property' &&
                (!datePropertyKey ||
                    !state.propertyDefinitions.some(
                        (definition) => definition.key === datePropertyKey && definition.valueType === 'date',
                    ))
            ) {
                return localError('Calendar date property is unavailable');
            }

            const calendarNotes = applyPropertyFilters(
                listNotesByTags(state, view.tagNames, view.mode),
                view.propertyFilters,
            )
                .flatMap((note) => {
                    const calendarDate =
                        dateField === 'property'
                            ? note.properties?.find((property) => property.key === datePropertyKey)?.value
                            : note[dateField];

                    if (!calendarDate) {
                        return [];
                    }

                    const timestamp = toTimestamp(calendarDate);
                    return timestamp >= start && timestamp < end
                        ? [{ id: note.id, title: note.title, calendarDate }]
                        : [];
                })
                .sort((left, right) => {
                    const comparison = toTimestamp(left.calendarDate) - toTimestamp(right.calendarDate);
                    return comparison || left.id.localeCompare(right.id);
                });

            return success({ viewCalendarNotes: calendarNotes });
        },
        FetchViewBoardColumn: ({ state, variables }) => {
            const view = state.viewWorkspace.groups
                .flatMap((group) => group.views)
                .find((item) => item.id === String(variables.id));

            if (!view || view.displayType !== 'board') {
                return localError('Board view not found');
            }

            const groupPropertyKey = view.displayOptions.boardGroupByPropertyKey;

            if (!groupPropertyKey) {
                return localError('Board grouping property is unavailable');
            }

            const optionValue = typeof variables.optionValue === 'string' ? variables.optionValue : null;
            const notes = sortViewNotes(
                applyPropertyFilters(listNotesByTags(state, view.tagNames, view.mode), view.propertyFilters),
                view,
            ).filter((note) => {
                const property = note.properties?.find((candidate) => candidate.key === groupPropertyKey);
                return optionValue === null ? !property : property?.value === optionValue;
            });

            return success({
                viewBoardColumn: { totalCount: notes.length, notes: paginate(notes, variables) },
            });
        },
        CreateViewGroup: ({ state, variables, save }) => {
            const group = {
                id: createLocalId('view-group'),
                title: String(variables.title),
                order: state.viewWorkspace.groups.length,
                views: [],
            };
            state.viewWorkspace.groups.push(group);
            state.viewWorkspace.activeGroupId = group.id;
            save();
            return success({ createViewGroup: { id: group.id } });
        },
        UpdateViewGroup: ({ state, variables, save }) => {
            const group = state.viewWorkspace.groups.find((item) => item.id === String(variables.id));
            if (group) group.title = String(variables.title);
            save();
            return success({ updateViewGroup: { id: String(variables.id) } });
        },
        DeleteViewGroup: ({ state, variables, save }) => {
            state.viewWorkspace.groups = state.viewWorkspace.groups.filter(
                (group) => group.id !== String(variables.id),
            );
            state.viewWorkspace.activeGroupId = state.viewWorkspace.groups[0]?.id ?? null;
            save();
            return success({ deleteViewGroup: true });
        },
        SetActiveViewGroup: ({ state, variables, save }) => {
            state.viewWorkspace.activeGroupId = String(variables.id);
            save();
            return success({ setActiveViewGroup: state.viewWorkspace });
        },
        ReorderViewGroups: ({ state, variables, save }) => {
            const groupIds = variables.groupIds as string[];
            state.viewWorkspace.groups.sort((a, b) => groupIds.indexOf(a.id) - groupIds.indexOf(b.id));
            state.viewWorkspace.groups.forEach((group, index) => (group.order = index));
            save();
            return success({ reorderViewGroups: state.viewWorkspace.groups.map((group) => ({ id: group.id })) });
        },
        CreateView: ({ state, variables, save }) => {
            const group = state.viewWorkspace.groups.find((item) => item.id === String(variables.groupId));
            if (!group) return localError('View group not found');

            const input = variables.input as Partial<View>;
            const view: View = {
                defaultTemplateNoteId: input.defaultTemplateNoteId ?? null,
                id: createLocalId('view-view'),
                groupId: group.id,
                title: input.title ?? 'Untitled view',
                displayType: input.displayType ?? 'list',
                displayOptions: input.displayOptions ?? {
                    tableColumns: [],
                    tablePropertyKeys: [],
                    boardGroupByPropertyKey: null,
                    calendarDateField: 'createdAt',
                    calendarDatePropertyKey: null,
                },
                tagNames: input.tagNames ?? [],
                mode: input.mode ?? 'and',
                propertyFilters: input.propertyFilters ?? [],
                sortBy: input.sortBy ?? 'updatedAt',
                sortOrder: input.sortOrder ?? 'desc',
                limit: input.limit ?? 25,
                order: group.views.length,
            };
            group.views.push(view);
            save();
            return success({ createView: { id: view.id } });
        },
        UpdateView: ({ state, variables, save }) => {
            const view = state.viewWorkspace.groups
                .flatMap((group) => group.views)
                .find((item) => item.id === String(variables.id));
            if (view) Object.assign(view, variables.input);
            save();
            return success({ updateView: { id: String(variables.id) } });
        },
        DeleteView: ({ state, variables, save }) => {
            for (const group of state.viewWorkspace.groups) {
                group.views = group.views.filter((view) => view.id !== String(variables.id));
            }
            save();
            return success({ deleteView: true });
        },
        ReorderViews: ({ state, variables, save }) => {
            const group = state.viewWorkspace.groups.find((item) => item.id === String(variables.groupId));
            const viewIds = variables.viewIds as string[];
            if (group) {
                group.views.sort((a, b) => viewIds.indexOf(a.id) - viewIds.indexOf(b.id));
                group.views.forEach((view, index) => (view.order = index));
            }
            save();
            return success({ reorderViews: group?.views.map((view) => ({ id: view.id })) ?? [] });
        },
    },
};
