import type { Tag } from '~/models/tag.model';
import { graphQuery } from '~/modules/graph-query';

export interface FetchTagsParams {
    query?: string;
    limit?: number;
    offset?: number;
}

export function fetchTags({ query = '', limit = 50, offset = 0 }: FetchTagsParams = {}) {
    return graphQuery<{
        allTags: {
            totalCount: number;
            tags: Pick<Tag, 'id' | 'name' | 'referenceCount'>[];
        };
    }>(
        `query FetchTags(
            $searchFilter: SearchFilterInput,
            $pagination: PaginationInput
        ) {
            allTags(
                searchFilter: $searchFilter,
                pagination: $pagination
            ) {
                totalCount
                tags {
                    id
                    name
                    referenceCount
                }
            }
        }`,
        {
            searchFilter: { query },
            pagination: {
                limit,
                offset,
            },
        },
    );
}

export interface CreateTagParams {
    name?: string;
}

export function createTag({ name = '' }: CreateTagParams) {
    return graphQuery<
        {
            createTag: Pick<Tag, 'id' | 'name'>;
        },
        { name: string }
    >(
        `mutation CreateTag($name: String!) {
            createTag(name: $name) {
                id
                name
            }
        }`,
        { name },
    );
}
