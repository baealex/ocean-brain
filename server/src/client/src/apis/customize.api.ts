import axios from 'axios';

interface Customize {
    color?: string;
    createdAt: string;
    heroBanner?: string;
    updatedAt: string;
}

export const getCustomize = async () => {
    const response = await axios<Customize>({
        method: 'GET',
        url: '/api/customize'
    });
    return response.data;
};

export const updateCustomize = async (data: Pick<Customize, 'color' | 'heroBanner'>) => {
    const response = await axios<Customize>({
        method: 'PUT',
        url: '/api/customize',
        data
    });
    return response.data;
};
