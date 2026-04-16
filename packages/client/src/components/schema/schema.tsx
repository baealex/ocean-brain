import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { CodeBlock } from './CodeBlock';
import type { OceanBrainCustomBlockType, OceanBrainCustomInlineContentType } from './custom-types';
import Reference from './Reference';
import TableOfContents from './TableOfContents';
import Tag from './Tag';

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

type CodeBlockSpec = typeof defaultBlockSpecs.codeBlock;

const defaultCodeBlock = defaultBlockSpecs.codeBlock;
const reactCodeBlockWithCopyButton = createReactBlockSpec(defaultCodeBlock.config, {
    meta: defaultCodeBlock.implementation.meta,
    parse: defaultCodeBlock.implementation.parse,
    parseContent: defaultCodeBlock.implementation.parseContent,
    runsBefore: defaultCodeBlock.implementation.runsBefore,
    render: CodeBlock,
})();

const codeBlockWithCopyButton: CodeBlockSpec = {
    ...reactCodeBlockWithCopyButton,
    extensions: defaultCodeBlock.extensions,
    implementation: {
        ...reactCodeBlockWithCopyButton.implementation,
        toExternalHTML: defaultCodeBlock.implementation.toExternalHTML,
    },
};

const schema = BlockNoteSchema.create({
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        ...oceanBrainInlineContentSpecs,
    },
    blockSpecs: {
        ...defaultBlockSpecs,
        codeBlock: codeBlockWithCopyButton,
        ...oceanBrainBlockSpecs,
    },
});

export default schema;
