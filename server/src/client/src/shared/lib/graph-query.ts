import axios from 'axios';

interface GraphQueryErrorResponse {
    type: 'error';
    errors: {
        message: string;
        locations: {
            line: number;
            column: number;
        }[];
        path: string[];
    }[];
}

export const graphQuery = async <T extends object, K = object>(query: string, variables?: K): Promise<T & { type: 'success' } | GraphQueryErrorResponse> => {
    const { data } = await axios('/graphql', {
        method: 'post',
        data: {
            query,
            variables
        }
    });
    if (data.errors) {
        return {
            type: 'error',
            ...data
        };
    }
    return {
        type: 'success',
        ...data.data
    };
};
