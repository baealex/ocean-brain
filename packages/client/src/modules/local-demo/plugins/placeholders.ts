import type { Placeholder } from '~/models/placeholder.model';
import { localError, success } from '../response';
import type { LocalDemoPlugin } from '../types';
import { getQueryText, now, paginate } from '../utils';

export const placeholdersLocalPlugin: LocalDemoPlugin = {
    name: 'placeholders',
    graphHandlers: {
        FetchPlaceholders: ({ state, variables }) => {
            const text = getQueryText(variables);
            const placeholders = state.placeholders.filter(
                (placeholder) =>
                    !text ||
                    placeholder.name.toLowerCase().includes(text) ||
                    placeholder.template.toLowerCase().includes(text),
            );
            return success({
                allPlaceholders: { totalCount: placeholders.length, placeholders: paginate(placeholders, variables) },
            });
        },
        CreatePlaceholder: ({ state, variables, save }) => {
            const timestamp = now();
            const placeholder: Placeholder = {
                id: Date.now(),
                name: String(variables.name),
                template: String(variables.template),
                replacement: String(variables.replacement),
                createdAt: timestamp,
                updatedAt: timestamp,
            };
            state.placeholders.push(placeholder);
            save();
            return success({ createPlaceholder: placeholder });
        },
        UpdatePlaceholder: ({ state, variables, save }) => {
            const placeholder = state.placeholders.find((item) => String(item.id) === String(variables.id));
            if (!placeholder) return localError('Placeholder not found');

            placeholder.name = String(variables.name);
            placeholder.template = String(variables.template);
            placeholder.replacement = String(variables.replacement);
            placeholder.updatedAt = now();
            save();
            return success({ updatePlaceholder: placeholder });
        },
        DeletePlaceholder: ({ state, variables, save }) => {
            state.placeholders = state.placeholders.filter(
                (placeholder) => String(placeholder.id) !== String(variables.id),
            );
            save();
            return success({ deletePlaceholder: true });
        },
    },
};
