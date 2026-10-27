import type { Note } from '~/models/note.model';
import type { View } from '~/models/view.model';
import { localError, success } from '../response';
import type { LocalDemoPlugin } from '../types';
import { applyPropertyFilters, createLocalId, listNotesByTags, paginate } from '../utils';

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
