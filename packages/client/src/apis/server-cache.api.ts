import {
    graphQuery,
    type GraphQueryErrorResponse
} from '~/modules/graph-query';

type CacheName = 'heroBanner';

interface CacheItem {
    value: string;
}

const isCacheItem = (value: unknown): value is CacheItem => {
    return typeof value === 'object'
        && value !== null
        && 'value' in value
        && typeof value.value === 'string';
};

const invalidResponseShape = (
    field: string,
    details: unknown
): GraphQueryErrorResponse => ({
    type: 'error',
    category: 'graphql',
    errors: [{
        code: 'INVALID_RESPONSE_SHAPE',
        message: `GraphQL response field "${field}" is missing or invalid`,
        details
    }]
});

export const getServerCache = async (key: CacheName) => {
    try {
        const response = await graphQuery<{ cache?: CacheItem }, { key: CacheName }>(`
        query GetServerCache($key: String!) {
            cache(key: $key) {
                value
            }
        }
    `, { key });

        if (response.type === 'error') {
            throw response;
        }

        if (!isCacheItem(response.cache)) {
            throw invalidResponseShape('cache', response);
        }

        return response.cache.value;
    } catch {
        return '';
    }
};

export const setServerCache = async (
    key: CacheName,
    value: string
) => {
    const response = await graphQuery<{ setCache?: CacheItem }, { key: CacheName; value: string }>(`
        mutation SetServerCache($key: String!, $value: String!) {
            setCache(key: $key, value: $value) {
                value
            }
        }
    `, {
        key,
        value: encodeURIComponent(value)
    });

    if (response.type === 'error') {
        return response;
    }

    if (!isCacheItem(response.setCache)) {
        return invalidResponseShape('setCache', response);
    }

    return {
        ...response,
        setCache: response.setCache
    };
};

export const deleteServerCache = async (key: CacheName) => {
    return graphQuery<{ deleteCache: boolean }, { key: CacheName }>(`
        mutation DeleteServerCache($key: String!) {
            deleteCache(key: $key)
        }
    `, { key });
};
