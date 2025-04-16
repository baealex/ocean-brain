import { graphQuery } from '~/modules/graph-query';
import type { Placeholder } from '~/models/placeholder.model';

export interface FetchPlaceholdersParams {
    limit?: number;
    offset?: number;
    query?: string;
    fields?: Partial<keyof Placeholder>[];
}

export const fetchPlaceholders = async ({
    limit = 25,
    offset = 0,
    query = '',
    fields
}: FetchPlaceholdersParams = {}) => {
    return graphQuery<{
        allPlaceholders: Placeholder[];
    }>(
        `query def(
            $searchFilter: SearchFilterInput,
            $pagination: PaginationInput
        ) {
            allPlaceholders(
                searchFilter: $searchFilter,
                pagination: $pagination
            ) {
                totalCount
                placeholders {
                    ${fields ? fields.join('\n') : ''}
                    id
                    name
                    template
                    replacement
                    createdAt
                    updatedAt
                }
            }
        }`,
        {
            searchFilter: { query },
            pagination: {
                limit,
                offset
            }
        }
    );
};

export const createPlaceholder = (placeholder: Placeholder) => {
    return graphQuery<{ createPlaceholder: Placeholder }>(
        `mutation {
            createPlaceholder(name: "${placeholder.name}", template: "${placeholder.template}", replacement: "${placeholder.replacement}") {
                id
                name
                template
                replacement
                createdAt
                updatedAt
            }
        }`,
    );
};

interface UpdatePlaceholderParams {
    id: string;
    name: string;
    template: string;
    replacement: string;
}

export const updatePlaceholder = (params: UpdatePlaceholderParams) => {
    return graphQuery<{ updatePlaceholder: Placeholder }>(
        `mutation {
            updatePlaceholder(id: "${params.id}", name: "${params.name}", template: "${params.template}", replacement: "${params.replacement}") {
                id
                name
            }
        }`,
    );
};

export const deletePlaceholder = (id: string) => {
    return graphQuery<{ deletePlaceholder: boolean }>(
        `mutation def($id: ID!) {
            deletePlaceholder(id: $id)
        }`,
        { id }
    );
};
