import type { Tag } from '~/models/Tag';
import { graphQuery } from '~/modules/graph-query';

export function fetchTags({
    query = '',
    limit = 999,
    offset = 0
} = {}) {
    return graphQuery<{
        allTags: Pick<Tag, 'id' | 'name' | 'referenceCount'>[];
    }>(
        `query {
            allTags(query: "${query}", limit: ${limit}, offset: ${offset}) {
                id
                name
                referenceCount
            }
        }`
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
