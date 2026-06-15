import { success } from '../response';
import type { LocalDemoPlugin } from '../types';
import { ensureTag, getQueryText, paginate, tagReferenceCount } from '../utils';

export const tagsLocalPlugin: LocalDemoPlugin = {
    name: 'tags',
    graphHandlers: {
        FetchTags: ({ state, variables }) => {
            const text = getQueryText(variables);
            const tags = state.tags
                .filter((tag) => !text || tag.name.toLowerCase().includes(text))
                .map((tag) => ({ ...tag, referenceCount: tagReferenceCount(state, tag.name) }));
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
