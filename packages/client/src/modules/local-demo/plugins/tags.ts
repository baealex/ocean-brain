import { success } from '../response';
import type { LocalDemoPlugin } from '../types';
import { ensureTag, getQueryText, getSearchFilter, paginate, tagReferenceCount } from '../utils';
import { localScopedNotes, localScopeId } from '../workspace';

export const tagsLocalPlugin: LocalDemoPlugin = {
    name: 'tags',
    graphHandlers: {
        FetchTags: ({ state, variables }) => {
            const text = getQueryText(variables);
            const scopedState = { ...state, notes: localScopedNotes(state, variables) };
            const scoped = localScopeId(state, variables) !== null;
            const searchFilter = getSearchFilter(variables) as
                | {
                      sortBy?: 'referenceCount' | 'name';
                      sortOrder?: 'asc' | 'desc';
                  }
                | undefined;
            const sortBy = searchFilter?.sortBy ?? 'referenceCount';
            const direction = searchFilter?.sortOrder === 'asc' ? 1 : -1;
            const tags = state.tags
                .filter((tag) => !text || tag.name.toLowerCase().includes(text))
                .map((tag) => ({ ...tag, referenceCount: tagReferenceCount(scopedState, tag.name) }))
                .filter((tag) => !scoped || tag.referenceCount > 0)
                .sort((a, b) => {
                    if (sortBy === 'referenceCount') {
                        return (a.referenceCount - b.referenceCount) * direction;
                    }

                    return String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? '')) * direction;
                });
            return success({
                allTags: { totalCount: tags.length, tags: paginate(tags, variables, { limit: 50, offset: 0 }) },
            });
        },
        CreateTag: ({ state, variables, save }) => {
            const tag = ensureTag(state, String(variables.name ?? ''));
            save();
            return success({ createTag: tag });
        },
    },
};
