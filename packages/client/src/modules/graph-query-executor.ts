import axios from 'axios';
import { isLocalOnlyDemoMode } from './demo-mode';
import { toGraphQLError, toNetworkError } from './graph-query-errors';
import type { GraphQLErrorPayload, GraphQueryRequest, GraphQueryResponse } from './graph-query-types';

export interface GraphQueryExecutor {
    execute<TData extends object, TVariables extends object>(
        request: GraphQueryRequest<TVariables>,
    ): Promise<GraphQueryResponse<TData>>;
}

const remoteGraphQueryExecutor: GraphQueryExecutor = {
    async execute<TData extends object, TVariables extends object>(request: GraphQueryRequest<TVariables>) {
        try {
            const { data } = await axios.post<{
                data?: TData;
                errors?: GraphQLErrorPayload[];
            }>('/graphql', request);

            if (data.errors && data.errors.length > 0) {
                return toGraphQLError(data.errors);
            }

            if (!data.data) {
                return {
                    type: 'error',
                    category: 'graphql',
                    errors: [
                        {
                            code: 'EMPTY_RESPONSE',
                            message: 'GraphQL response data is empty',
                            details: data,
                        },
                    ],
                };
            }

            return {
                type: 'success',
                ...data.data,
            };
        } catch (error) {
            return toNetworkError(error);
        }
    },
};

const localOnlyDemoGraphQueryExecutor: GraphQueryExecutor = {
    async execute<TData extends object, TVariables extends object>(request: GraphQueryRequest<TVariables>) {
        const { executeLocalDemoGraphQuery } = await import('./local-demo/client');
        return executeLocalDemoGraphQuery<TData>(request as GraphQueryRequest<object>);
    },
};

const graphQueryExecutors = {
    server: remoteGraphQueryExecutor,
    'local-only': localOnlyDemoGraphQueryExecutor,
} satisfies Record<string, GraphQueryExecutor>;

export const getGraphQueryExecutor = () => {
    return isLocalOnlyDemoMode() ? graphQueryExecutors['local-only'] : graphQueryExecutors.server;
};
