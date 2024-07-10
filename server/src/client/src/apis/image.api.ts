import axios from 'axios';
import { graphQuery } from '~/modules/graph-query';

export function fetchImages({
    limit = 999,
    offset = 0
} = {}) {
    return graphQuery<{
        allImages: {
            id: string;
            url: string;
            referenceCount: number;
        }[];
    }>(
        `query {
            allImages(limit: ${limit}, offset: ${offset}) {
                id
                url
                referenceCount
            }
        }`,
    ).then(data => data.allImages);
}

export function fetchImage(id: string) {
    return graphQuery<{
        image: {
            id: string;
            url: string;
        };
    }>(
        `query {
            image(id: ${id}) {
                id
                url
            }
        }`,
    ).then(data => data.image);
}

export function deleteImage(id: string) {
    return graphQuery(
        `mutation {
            deleteImage(id: ${id})
        }`,
    ).then(data => data.deleteImage);
}

export async function uploadImage({ base64, externalSrc }: { base64?: string; externalSrc?: string }): Promise<string> {
    if (base64) {
        const { data } = await axios.post('/image', { image: base64 });
        return data.url;
    }

    if (externalSrc) {
        const { data } = await axios.post('/image-from-src', { src: externalSrc });
        return data.url;
    }

    throw new Error('No file or src provided');
}
