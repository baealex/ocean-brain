import { success } from '../response';
import type { LocalDemoPlugin } from '../types';
import { paginate } from '../utils';

export const imagesLocalPlugin: LocalDemoPlugin = {
    name: 'images',
    graphHandlers: {
        FetchImages: ({ state, variables }) => {
            const images = state.images.map((image) => ({
                ...image,
                referenceCount: state.notes.filter((note) => note.content.includes(image.url)).length,
            }));
            return success({
                allImages: { totalCount: images.length, images: paginate(images, variables, { limit: 50, offset: 0 }) },
            });
        },
        FetchImage: ({ state, variables }) => {
            return success({ image: state.images.find((image) => image.id === String(variables.id)) ?? null });
        },
        DeleteImage: ({ state, variables, save }) => {
            state.images = state.images.filter((image) => image.id !== String(variables.id));
            save();
            return success({ deleteImage: true });
        },
    },
};
