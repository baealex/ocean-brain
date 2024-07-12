import axios from 'axios';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const graphQuery = async <T = any>(query: string, variables?: any): Promise<T> => {
    const { data } = await axios('/graphql', {
        method: 'post',
        data: {
            query,
            variables
        }
    });
    return data.data;
};
