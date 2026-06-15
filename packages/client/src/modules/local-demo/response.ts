import type { GraphQueryErrorResponse, GraphQueryResponse } from '../graph-query-types';
import type { LocalGraphData } from './types';

export const success = (data: LocalGraphData): GraphQueryResponse<LocalGraphData> => ({ type: 'success', ...data });

export const localError = (message: string): GraphQueryErrorResponse => ({
    type: 'error',
    category: 'graphql',
    errors: [{ code: 'LOCAL_ONLY_DEMO_ERROR', message }],
});
