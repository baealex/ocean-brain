import { uploadImage as uploadImageWithAdapter } from '~/apis/image-upload-adapter';
import type { Image } from '~/models/image.model';
import { graphQuery } from '~/modules/graph-query';

export interface FetchImagesParams {
    limit?: number;
    offset?: number;
}

export function fetchImages({ limit = 50, offset = 0 }: FetchImagesParams = {}) {
    return graphQuery<{
        allImages: {
            totalCount: number;
            images: Image[];
        };
    }>(
        `query FetchImages($pagination: PaginationInput) {
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
                offset,
            },
        },
    );
}

export function fetchImage(id: string) {
    return graphQuery<
        {
            image: Pick<Image, 'id' | 'url'>;
        },
        { id: string }
    >(
        `query FetchImage($id: ID!) {
            image(id: $id) {
                id
                url
            }
        }`,
        { id },
    );
}

export function deleteImage(id: string) {
    return graphQuery<{ deleteImage: boolean }, { id: string }>(
        `mutation DeleteImage($id: ID!) {
            deleteImage(id: $id)
        }`,
        { id },
    );
}

export const uploadImage = uploadImageWithAdapter;
