import type { Placeholder } from '~/models/placeholder.model';
import { graphQuery } from '~/modules/graph-query';

const PLACEHOLDER_FIELDS = ['id', 'name', 'template', 'replacement', 'createdAt', 'updatedAt'] as const;

type PlaceholderField = (typeof PLACEHOLDER_FIELDS)[number];

const PLACEHOLDER_FIELD_SET = new Set<string>(PLACEHOLDER_FIELDS);

const FETCH_PLACEHOLDERS_QUERY = `query FetchPlaceholders(
            $searchFilter: SearchFilterInput,
            $pagination: PaginationInput
        ) {
            allPlaceholders(
                searchFilter: $searchFilter,
                pagination: $pagination
            ) {
                totalCount
                placeholders {
__PLACEHOLDER_FIELDS__                }
            }
        }`;

const buildPlaceholderSelection = (fields?: (keyof Placeholder)[]) => {
    const selectedFields =
        fields && fields.length > 0
            ? fields.filter((field): field is PlaceholderField => PLACEHOLDER_FIELD_SET.has(field))
            : PLACEHOLDER_FIELDS;

    const safeFields = Array.from(new Set(selectedFields));
    return safeFields.map((field) => '                    ' + field).join('\n') + '\n';
};

export interface FetchPlaceholdersParams {
    limit?: number;
    offset?: number;
    query?: string;
    fields?: (keyof Placeholder)[];
}

export const fetchPlaceholders = async ({
    limit = 25,
    offset = 0,
    query = '',
    fields,
}: FetchPlaceholdersParams = {}) => {
    const placeholderSelection = buildPlaceholderSelection(fields);
    const graphqlQuery = FETCH_PLACEHOLDERS_QUERY.replace('__PLACEHOLDER_FIELDS__', placeholderSelection);

    return graphQuery<{
        allPlaceholders: {
            totalCount: number;
            placeholders: Placeholder[];
        };
    }>(graphqlQuery, {
        searchFilter: { query },
        pagination: {
            limit,
            offset,
        },
    });
};

export interface CreatePlaceholderRequest {
    name: string;
    template: string;
    replacement: string;
}

export const createPlaceholder = (placeholder: CreatePlaceholderRequest) => {
    return graphQuery<{ createPlaceholder: Placeholder }, CreatePlaceholderRequest>(
        `mutation CreatePlaceholder(
            $name: String!,
            $template: String!,
            $replacement: String!
        ) {
            createPlaceholder(
                name: $name,
                template: $template,
                replacement: $replacement
            ) {
                id
                name
                template
                replacement
                createdAt
                updatedAt
            }
        }`,
        placeholder,
    );
};

export interface UpdatePlaceholderParams {
    id: string;
    name: string;
    template: string;
    replacement: string;
}

export const updatePlaceholder = (params: UpdatePlaceholderParams) => {
    return graphQuery<{ updatePlaceholder: Placeholder }, UpdatePlaceholderParams>(
        `mutation UpdatePlaceholder(
            $id: ID!,
            $name: String!,
            $template: String!,
            $replacement: String!
        ) {
            updatePlaceholder(
                id: $id,
                name: $name,
                template: $template,
                replacement: $replacement
            ) {
                id
                name
            }
        }`,
        params,
    );
};

export const deletePlaceholder = (id: string) => {
    return graphQuery<{ deletePlaceholder: boolean }, { id: string }>(
        `mutation DeletePlaceholder($id: ID!) {
            deletePlaceholder(id: $id)
        }`,
        { id },
    );
};
