import axios from 'axios';
import { graphQuery } from '~/modules/graph-query';

import type { Image } from '~/models/Image';

export function fetchImages({
    limit = 50,
    offset = 0
} = {}) {
    return graphQuery<{
        allImages: {
            totalCount: number;
            images: Image[];
        };
    }>(
        `query def($pagination: PaginationInput) {
            allImages(pagination: $pagination) {
                totalCount
                images {
                    id
                    url
                    referenceCount
                }
            }
        }`,
        {
            pagination: {
                limit,
                offset
            }
        }
    );
}

export function fetchImage(id: string) {
    return graphQuery<{
        image: Pick<Image, 'id' | 'url'>;
    }>(
        `query {
            image(id: ${id}) {
                id
                url
            }
        }`,
    );
}

export function deleteImage(id: string) {
    return graphQuery(
        `mutation {
            deleteImage(id: ${id})
        }`,
    );
}

export async function uploadImage({ base64, externalSrc }: { base64?: string; externalSrc?: string }): Promise<string> {
    if (base64) {
        const { data } = await axios.post('/api/image', { image: base64 });
        return data.url;
    }

    if (externalSrc) {
        const { data } = await axios.post('/api/image-from-src', { src: externalSrc });
        return data.url;
    }

    throw new Error('No file or src provided');
}
