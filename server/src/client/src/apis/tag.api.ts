import type { Tag } from '~/models/Tag';
import { graphQuery } from '~/modules/graph-query';

export function fetchTags({
    query = '',
    limit = 50,
    offset = 0
} = {}) {
    return graphQuery<{
        allTags: {
            totalCount: number;
            tags: Pick<Tag, 'id' | 'name' | 'referenceCount'>[];
        };
    }>(
        `query def(
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
                offset
            }
        }
    ).then(data => data.allTags);
}

export function createTag({ name = '' }) {
    return graphQuery<{
        createTag: Pick<Tag, 'id' | 'name'>;
    }>(
        `mutation {
            createTag(name: "${name}") {
                id
                name
            }
        }`
    ).then(data => data.createTag);
}
