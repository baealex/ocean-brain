import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';

import Reference from './Reference';
import Tag from './Tag';
import TableOfContents from './TableOfContents';
import type { OceanBrainCustomBlockType, OceanBrainCustomInlineContentType } from './custom-types';

const defineOceanBrainInlineContentSpecs = <T extends Record<OceanBrainCustomInlineContentType, unknown>>(
    specs: T & Record<Exclude<keyof T, OceanBrainCustomInlineContentType>, never>,
) => specs;

const defineOceanBrainBlockSpecs = <T extends Record<OceanBrainCustomBlockType, unknown>>(
    specs: T & Record<Exclude<keyof T, OceanBrainCustomBlockType>, never>,
) => specs;

const oceanBrainInlineContentSpecs = defineOceanBrainInlineContentSpecs({
    tag: Tag,
    reference: Reference,
});

const oceanBrainBlockSpecs = defineOceanBrainBlockSpecs({ tableOfContents: TableOfContents });

const schema = BlockNoteSchema.create({
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        ...oceanBrainInlineContentSpecs,
    },
    blockSpecs: {
        ...defaultBlockSpecs,
        ...oceanBrainBlockSpecs,
    },
});

export default schema;
