interface MarkdownInlineContent {
    type: string;
    props?: Record<string, unknown>;
    text?: string;
    styles?: Record<string, unknown>;
    [key: string]: unknown;
}

interface MarkdownTableCell {
    content?: MarkdownInlineContent[];
    [key: string]: unknown;
}

interface MarkdownTableRow {
    cells?: MarkdownTableCell[];
    [key: string]: unknown;
}

interface MarkdownTableContent {
    type: 'tableContent';
    rows?: MarkdownTableRow[];
    [key: string]: unknown;
}

export interface MarkdownBlock {
    type: string;
    content?: MarkdownInlineContent[] | MarkdownTableContent;
    children?: MarkdownBlock[];
    [key: string]: unknown;
}

const UNSUPPORTED_MARKDOWN_BLOCK_TYPES = new Set(['tableOfContents']);
const TAG_PLACEHOLDER_PREFIX = 'OCEAN_BRAIN_TAG_';
const TAG_PLACEHOLDER_SUFFIX = '_TOKEN';

const createTagPlaceholder = (index: number) => `${TAG_PLACEHOLDER_PREFIX}${index}${TAG_PLACEHOLDER_SUFFIX}`;

const isTableContent = (content: MarkdownBlock['content']): content is MarkdownTableContent => {
    return !Array.isArray(content) && content?.type === 'tableContent';
};

const mapBlockContent = (
    content: MarkdownBlock['content'],
    mapInline: (inline: MarkdownInlineContent) => MarkdownInlineContent,
): MarkdownBlock['content'] => {
    if (Array.isArray(content)) {
        return content.map(mapInline);
    }

    if (!isTableContent(content)) {
        return content;
    }

    return {
        ...content,
        rows: content.rows?.map((row) => ({
            ...row,
            cells: row.cells?.map((cell) => ({
                ...cell,
                content: cell.content?.map(mapInline),
            })),
        })),
    };
};

const mapBlocks = (
    blocks: MarkdownBlock[],
    mapContent: (content: MarkdownBlock['content']) => MarkdownBlock['content'],
): MarkdownBlock[] => {
    return blocks
        .filter((block) => !UNSUPPORTED_MARKDOWN_BLOCK_TYPES.has(block.type))
        .map((block) => ({
            ...block,
            content: mapContent(block.content),
            children: block.children?.length ? mapBlocks(block.children, mapContent) : [],
        }));
};

export function prepareBlocksForMarkdown(blocks: MarkdownBlock[]) {
    const placeholderToTag = new Map<string, string>();
    let nextPlaceholderIndex = 0;

    const markdownBlocks = mapBlocks(blocks, (content) =>
        mapBlockContent(content, (inline) => {
            if (inline.type === 'reference') {
                const id = String(inline.props?.id || '');
                const title = String(inline.props?.title || inline.props?.id || '');
                const text = id ? `[[${title}]](note:${id})` : `[[${title}]]`;

                return {
                    type: 'text',
                    text,
                    styles: {},
                };
            }

            if (inline.type === 'tag') {
                const tag = (inline.props?.tag as string) || '';
                const placeholder = createTagPlaceholder(nextPlaceholderIndex);
                nextPlaceholderIndex += 1;
                placeholderToTag.set(placeholder, tag);

                return {
                    type: 'text',
                    text: placeholder,
                    styles: {},
                };
            }

            return inline;
        }),
    );

    return { blocks: markdownBlocks, placeholderToTag };
}

export function restoreTagPlaceholdersInMarkdown(markdown: string, placeholderToTag: Map<string, string>) {
    let restoredMarkdown = markdown;

    for (const [placeholder, tag] of placeholderToTag.entries()) {
        restoredMarkdown = restoredMarkdown.split(placeholder).join(`[${tag}]`);
    }

    return restoredMarkdown;
}
