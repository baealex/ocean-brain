import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';

import Reference from './Reference';
import Tag from './Tag';
import TableOfContents from './TableOfContents';

const schema = BlockNoteSchema.create({
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        tag: Tag,
        reference: Reference
    },
    blockSpecs: {
        ...defaultBlockSpecs,
        tableOfContents: TableOfContents
    }
});

export default schema;
