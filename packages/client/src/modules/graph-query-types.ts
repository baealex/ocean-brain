export type GraphQueryErrorCategory = 'graphql' | 'network';

export interface GraphQLErrorPayload {
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
