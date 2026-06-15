import { getGraphQueryExecutor } from './graph-query-executor';

export type {
    GraphQLErrorPayload,
    GraphQueryError,
    GraphQueryErrorCategory,
    GraphQueryErrorResponse,
    GraphQueryRequest,
    GraphQueryResponse,
} from './graph-query-types';

import type { GraphQueryRequest, GraphQueryResponse } from './graph-query-types';

export function graphQuery<TData extends object, TVariables extends object = Record<string, unknown>>(
    request: GraphQueryRequest<TVariables>,
): Promise<GraphQueryResponse<TData>>;
export function graphQuery<TData extends object, TVariables extends object = Record<string, unknown>>(
    query: string,
    variables?: TVariables,
    operationName?: string,
): Promise<GraphQueryResponse<TData>>;
export async function graphQuery<TData extends object, TVariables extends object = Record<string, unknown>>(
    queryOrRequest: string | GraphQueryRequest<TVariables>,
    variables?: TVariables,
    operationName?: string,
): Promise<GraphQueryResponse<TData>> {
    const request =
        typeof queryOrRequest === 'string'
            ? {
                  query: queryOrRequest,
                  variables,
                  operationName,
              }
            : queryOrRequest;

    return getGraphQueryExecutor().execute<TData, TVariables>(request);
}
