export const OCEAN_BRAIN_CUSTOM_INLINE_CONTENT_TYPES = [
    'tag',
    'reference'
] as const;

export type OceanBrainCustomInlineContentType =
    (typeof OCEAN_BRAIN_CUSTOM_INLINE_CONTENT_TYPES)[number];

export const OCEAN_BRAIN_CUSTOM_BLOCK_TYPES = [
    'tableOfContents'
] as const;

export type OceanBrainCustomBlockType =
    (typeof OCEAN_BRAIN_CUSTOM_BLOCK_TYPES)[number];
