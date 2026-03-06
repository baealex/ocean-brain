import { graphQuery } from '~/modules/graph-query';

type CacheName = 'heroBanner';

interface CacheItem {
    value: string;
}

export const getServerCache = async (key: CacheName) => {
    try {
        const response = await graphQuery<{ cache: CacheItem }, { key: CacheName }>(`
        query GetServerCache($key: String!) {
            cache(key: $key) {
                value
            }
        }
    `, { key });
        if (response.type === 'error') {
            throw response;
        }
        return response.cache.value;
    } catch {
        return '';
    }
};

export const setServerCache = async (key: CacheName, value: string) => {
    return graphQuery<{ cache: CacheItem }, { key: CacheName; value: string }>(`
        mutation SetServerCache($key: String!, $value: String!) {
            setCache(key: $key, value: $value) {
                value
            }
        }
    `, {
        key,
        value: encodeURIComponent(value)
    });
};

export const deleteServerCache = async (key: CacheName) => {
    return graphQuery<{ deleteCache: boolean }, { key: CacheName }>(`
        mutation DeleteServerCache($key: String!) {
            deleteCache(key: $key)
        }
    `, { key });
};
