import { graphQuery } from '~/modules/graph-query';

type CacheName = 'heroBanner';

export const getServerCache = async (key: CacheName) => {
    try {
        const response = await graphQuery<{ cache: { value: string } }>(`
        query {
            cache(key: "${key}") {
                value
            }
        }
    `);
        if (response.type === 'error') {
            throw response;
        }
        return response.cache.value;
    } catch {
        return '';
    }
};

export const setServerCache = async (key: CacheName, value: string) => {
    return graphQuery<{ cache: { value: string } }>(`
        mutation {
            setCache(key: "${key}", value: "${encodeURIComponent(value)}") {
                value
            }
        }
    `);
};

export const deleteServerCache = async (key: CacheName) => {
    return graphQuery<{ deleteCache: boolean }>(`
        mutation {
            deleteCache(key: "${key}")
        }
    `);
};
