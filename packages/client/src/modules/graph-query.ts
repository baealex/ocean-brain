import axios from 'axios';

type GraphQueryErrorCategory = 'graphql' | 'network';

interface GraphQLErrorPayload {
    message?: string;
    extensions?: {
        code?: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface GraphQueryError {
    code: string;
    message: string;
    details?: unknown;
}

export interface GraphQueryErrorResponse {
    type: 'error';
    category: GraphQueryErrorCategory;
    errors: GraphQueryError[];
}

export interface GraphQueryRequest<TVariables extends object = Record<string, unknown>> {
    query: string;
    variables?: TVariables;
    operationName?: string;
}

type GraphQuerySuccessResponse<TData extends object> = TData & {
    type: 'success';
};

export type GraphQueryResponse<TData extends object> = GraphQuerySuccessResponse<TData> | GraphQueryErrorResponse;

const toGraphQLError = (errors: GraphQLErrorPayload[]): GraphQueryErrorResponse => {
    return {
        type: 'error',
        category: 'graphql',
        errors: errors.map((error) => ({
            code: error.extensions?.code ?? 'GRAPHQL_ERROR',
            message: error.message ?? 'GraphQL request failed',
            details: error
        }))
    };
};

const toNetworkError = (error: unknown): GraphQueryErrorResponse => {
    const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ?? error.message ?? 'Network request failed'
        : 'Network request failed';

    const code = axios.isAxiosError(error)
        ? error.code ?? (error.response?.status ? `HTTP_${error.response.status}` : 'NETWORK_ERROR')
        : 'NETWORK_ERROR';

    const details = axios.isAxiosError(error) ? error.response?.data : undefined;

    return {
        type: 'error',
        category: 'network',
        errors: [{
            code,
            message,
            details
        }]
    };
};

export function graphQuery<TData extends object, TVariables extends object = Record<string, unknown>>(
    request: GraphQueryRequest<TVariables>
): Promise<GraphQueryResponse<TData>>;
export function graphQuery<TData extends object, TVariables extends object = Record<string, unknown>>(
    query: string,
    variables?: TVariables,
    operationName?: string
): Promise<GraphQueryResponse<TData>>;
export async function graphQuery<TData extends object, TVariables extends object = Record<string, unknown>>(
    queryOrRequest: string | GraphQueryRequest<TVariables>,
    variables?: TVariables,
    operationName?: string
): Promise<GraphQueryResponse<TData>> {
    const request = typeof queryOrRequest === 'string'
        ? {
            query: queryOrRequest,
            variables,
            operationName
        }
        : queryOrRequest;

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
                errors: [{
                    code: 'EMPTY_RESPONSE',
                    message: 'GraphQL response data is empty',
                    details: data
                }]
            };
        }

        return {
            type: 'success',
            ...data.data
        };
    } catch (error) {
        return toNetworkError(error);
    }
};
