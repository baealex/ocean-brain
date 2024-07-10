import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';

import Reference from './Reference';
import Tag from './Tag';

const schema = BlockNoteSchema.create({
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        tag: Tag,
        reference: Reference
    },
    blockSpecs: { ...defaultBlockSpecs }
});

export default schema;
