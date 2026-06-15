import axios from 'axios';
import type { GraphQLErrorPayload, GraphQueryErrorResponse } from './graph-query-types';

export const toGraphQLError = (errors: GraphQLErrorPayload[]): GraphQueryErrorResponse => {
    return {
        type: 'error',
        category: 'graphql',
        errors: errors.map((error) => ({
            code: error.extensions?.code ?? 'GRAPHQL_ERROR',
            message: error.message ?? 'GraphQL request failed',
            details: error,
        })),
    };
};

export const toNetworkError = (error: unknown): GraphQueryErrorResponse => {
    const message = axios.isAxiosError<{ message?: string }>(error)
        ? (error.response?.data?.message ?? error.message ?? 'Network request failed')
        : 'Network request failed';

    const code = axios.isAxiosError(error)
        ? (error.code ?? (error.response?.status ? `HTTP_${error.response.status}` : 'NETWORK_ERROR'))
        : 'NETWORK_ERROR';

    const details = axios.isAxiosError(error) ? error.response?.data : undefined;

    return {
        type: 'error',
        category: 'network',
        errors: [
            {
                code,
                message,
                details,
            },
        ],
    };
};
