import { ServerBlockNoteEditor } from '@blocknote/server-util';

import models from '~/models.js';
import { ensureTagByName } from './tag-organization.js';

interface BlockNote {
    id?: string;
    type: string;
    props?: Record<string, unknown>;
    content?: BlockNoteContent;
    children?: BlockNote[];
    text?: string;
    styles?: Record<string, unknown>;
}

interface BlockNoteInline {
    type: string;
    props?: Record<string, unknown>;
    text?: string;
    styles?: Record<string, unknown>;
}

interface BlockNoteTableCell {
    type: 'tableCell';
    props?: Record<string, unknown>;
    content?: BlockNoteInline[];
}

interface BlockNoteTableRow {
    cells?: BlockNoteTableCell[];
}

interface BlockNoteTableContent {
    type: 'tableContent';
    columnWidths?: Array<number | null>;
    headerRows?: number;
    rows?: BlockNoteTableRow[];
}

type BlockNoteContent = BlockNoteInline[] | BlockNoteTableContent;

interface MarkdownImportDeps {
    ensureTag: (name: string) => Promise<
        | {
            id: string;
            name: string;
        }
        | {
            tag: {
                id: string;
                name: string;
            };
        }
    >;
    findNotesByTitle: (title: string) => Promise<Array<{
        id: string;
        title: string;
    }>>;
}

const UNSUPPORTED_MARKDOWN_BLOCK_TYPES = new Set([
    'tableOfContents'
]);
const TAG_PLACEHOLDER_PREFIX = 'OCEAN_BRAIN_TAG_';
const TAG_PLACEHOLDER_SUFFIX = '_TOKEN';

const defaultMarkdownImportDeps: MarkdownImportDeps = {
    ensureTag: async (name) => ensureTagByName(name),
    findNotesByTitle: async (title) => {
        const notes = await models.note.findMany({
            select: {
                id: true,
                title: true
            },
            where: { title },
            orderBy: { createdAt: 'asc' },
            take: 2
        });

        return notes.map((note) => ({
            id: String(note.id),
            title: note.title
        }));
    }
};

function stripUnsupportedMarkdownBlocks(blocks: BlockNote[]): BlockNote[] {
    return blocks
        .filter((block) => !UNSUPPORTED_MARKDOWN_BLOCK_TYPES.has(block.type))
        .map((block) => ({
            ...block,
            children: block.children?.length
                ? stripUnsupportedMarkdownBlocks(block.children)
                : []
        }));
}

function createTagPlaceholder(index: number) {
    return `${TAG_PLACEHOLDER_PREFIX}${index}${TAG_PLACEHOLDER_SUFFIX}`;
}

function isTableContent(content: BlockNoteContent | undefined): content is BlockNoteTableContent {
    return !Array.isArray(content) && content?.type === 'tableContent';
}

function mapBlockContent(
    content: BlockNoteContent | undefined,
    mapInline: (inline: BlockNoteInline) => BlockNoteInline
): BlockNoteContent | undefined {
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
                content: cell.content?.map(mapInline)
            }))
        }))
    };
}

async function mapBlockContentAsync(
    content: BlockNoteContent | undefined,
    mapInline: (inline: BlockNoteInline) => Promise<BlockNoteInline[]>
): Promise<BlockNoteContent | undefined> {
    if (Array.isArray(content)) {
        return (await Promise.all(content.map(mapInline))).flat();
    }

    if (!isTableContent(content)) {
        return content;
    }

    return {
        ...content,
        rows: await Promise.all(
            (content.rows ?? []).map(async (row) => ({
                ...row,
                cells: await Promise.all(
                    (row.cells ?? []).map(async (cell) => ({
                        ...cell,
                        content: cell.content
                            ? (await Promise.all(cell.content.map(mapInline))).flat()
                            : cell.content
                    }))
                )
            }))
        )
    };
}

function visitBlockContent(
    content: BlockNoteContent | undefined,
    visitInline: (inline: BlockNoteInline) => void
) {
    if (Array.isArray(content)) {
        for (const inline of content) {
            visitInline(inline);
        }
        return;
    }

    if (!isTableContent(content)) {
        return;
    }

    for (const row of content.rows ?? []) {
        for (const cell of row.cells ?? []) {
            for (const inline of cell.content ?? []) {
                visitInline(inline);
            }
        }
    }
}

function mapBlocks(
    blocks: BlockNote[],
    mapContent: (content: BlockNoteContent | undefined) => BlockNoteContent | undefined
): BlockNote[] {
    return blocks.map((block) => ({
        ...block,
        content: mapContent(block.content),
        children: block.children?.length
            ? mapBlocks(block.children, mapContent)
            : []
    }));
}

async function mapBlocksAsync(
    blocks: BlockNote[],
    mapContent: (content: BlockNoteContent | undefined) => Promise<BlockNoteContent | undefined>
): Promise<BlockNote[]> {
    return Promise.all(
        blocks.map(async (block) => ({
            ...block,
            content: await mapContent(block.content),
            children: block.children?.length
                ? await mapBlocksAsync(block.children, mapContent)
                : []
        }))
    );
}

function preprocessCustomInlineContent(
    blocks: BlockNote[],
    placeholderToTag: Map<string, string>,
    nextPlaceholderIndex: { value: number }
): BlockNote[] {
    return mapBlocks(
        blocks,
        (content) => mapBlockContent(content, (inline) => {
            if (inline.type === 'reference') {
                return {
                    type: 'text',
                    text: `[[${inline.props?.title || inline.props?.id || ''}]]`,
                    styles: {}
                };
            }
            if (inline.type === 'tag') {
                const tag = (inline.props?.tag as string) || '';
                const placeholder = createTagPlaceholder(nextPlaceholderIndex.value++);
                placeholderToTag.set(placeholder, tag);
                return {
                    type: 'text',
                    text: placeholder,
                    styles: {}
                };
            }
            return inline;
        })
    );
}

function restoreTagPlaceholdersInMarkdown(markdown: string, placeholderToTag: Map<string, string>) {
    let restoredMarkdown = markdown;

    for (const [placeholder, tag] of placeholderToTag.entries()) {
        restoredMarkdown = restoredMarkdown.split(placeholder).join(`[${tag}]`);
    }

    return restoredMarkdown;
}

function preprocessMarkdownExplicitTags(markdown: string) {
    const placeholderToTag = new Map<string, string>();
    let nextPlaceholderIndex = 0;
    const preprocessedMarkdown = markdown.replace(/\[([@#][^\s[\]]+)\]/g, (_match, tagToken: string) => {
        const placeholder = createTagPlaceholder(nextPlaceholderIndex++);
        placeholderToTag.set(placeholder, tagToken);
        return placeholder;
    });

    return {
        markdown: preprocessedMarkdown,
        placeholderToTag
    };
}

function findTagPlaceholderAtCursor(
    text: string,
    cursor: number,
    placeholderToTag: Map<string, string>
) {
    for (const [placeholder, tagToken] of placeholderToTag.entries()) {
        if (text.startsWith(placeholder, cursor)) {
            return {
                placeholder,
                tagToken
            };
        }
    }

    return null;
}

function restoreRemainingTagPlaceholders(
    blocks: BlockNote[],
    placeholderToTag: Map<string, string>
): BlockNote[] {
    return mapBlocks(
        blocks,
        (content) => mapBlockContent(content, (inline) => {
            if (inline.type !== 'text' || typeof inline.text !== 'string') {
                return inline;
            }

            let text = inline.text;

            for (const [placeholder, tagToken] of placeholderToTag.entries()) {
                text = text.split(placeholder).join(`[${tagToken}]`);
            }

            return {
                ...inline,
                text
            };
        })
    );
}

function createTextInline(text: string, styles: Record<string, unknown> = {}): BlockNoteInline {
    return {
        type: 'text',
        text,
        styles
    };
}

function appendInline(target: BlockNoteInline[], inline: BlockNoteInline) {
    const previous = target.at(-1);

    if (
        previous?.type === 'text' &&
        inline.type === 'text' &&
        previous.text !== undefined &&
        inline.text !== undefined &&
        JSON.stringify(previous.styles ?? {}) === JSON.stringify(inline.styles ?? {})
    ) {
        previous.text += inline.text;
        return;
    }

    target.push(inline);
}

async function restoreCustomInlineContent(
    blocks: BlockNote[],
    deps: MarkdownImportDeps,
    placeholderToTag: Map<string, string>
): Promise<BlockNote[]> {
    const tagCache = new Map<string, Promise<{ id: string; tag: string }>>();
    const noteCache = new Map<string, Promise<Array<{ id: string; title: string }>>>();

    const getTag = (token: string) => {
        const normalizedToken = token.startsWith('#')
            ? `@${token.slice(1)}`
            : token;
        let existing = tagCache.get(normalizedToken);

        if (!existing) {
            existing = deps.ensureTag(normalizedToken.slice(1)).then((result) => ({
                id: 'tag' in result ? result.tag.id : result.id,
                tag: 'tag' in result ? result.tag.name : result.name
            }));
            tagCache.set(normalizedToken, existing);
        }

        return existing;
    };

    const getNotesByTitle = (title: string) => {
        let existing = noteCache.get(title);

        if (!existing) {
            existing = deps.findNotesByTitle(title);
            noteCache.set(title, existing);
        }

        return existing;
    };

    const restoreTextInline = async (inline: BlockNoteInline): Promise<BlockNoteInline[]> => {
        if (
            inline.type !== 'text' ||
            typeof inline.text !== 'string' ||
            !inline.text ||
            inline.styles?.code === true
        ) {
            return [inline];
        }

        const restored: BlockNoteInline[] = [];
        const styles = inline.styles ?? {};
        let cursor = 0;

        while (cursor < inline.text.length) {
            if (inline.text.startsWith('[[', cursor)) {
                const closeIndex = inline.text.indexOf(']]', cursor + 2);

                if (closeIndex !== -1) {
                    const title = inline.text.slice(cursor + 2, closeIndex);
                    const matchingNotes = await getNotesByTitle(title);

                    if (matchingNotes.length === 1) {
                        appendInline(restored, {
                            type: 'reference',
                            props: {
                                id: matchingNotes[0].id,
                                title: matchingNotes[0].title
                            }
                        });
                        cursor = closeIndex + 2;
                        continue;
                    }
                }
            }

            const tagPlaceholderMatch = findTagPlaceholderAtCursor(inline.text, cursor, placeholderToTag);

            if (tagPlaceholderMatch) {
                const tag = await getTag(tagPlaceholderMatch.tagToken);
                appendInline(restored, {
                    type: 'tag',
                    props: tag
                });
                cursor += tagPlaceholderMatch.placeholder.length;
                continue;
            }

            let nextCursor = inline.text.length;

            const nextReferenceCursor = inline.text.indexOf('[[', cursor + 1);

            if (nextReferenceCursor !== -1) {
                nextCursor = Math.min(nextCursor, nextReferenceCursor);
            }

            for (const placeholder of placeholderToTag.keys()) {
                const nextPlaceholderCursor = inline.text.indexOf(placeholder, cursor + 1);

                if (nextPlaceholderCursor !== -1) {
                    nextCursor = Math.min(nextCursor, nextPlaceholderCursor);
                }
            }

            appendInline(restored, createTextInline(inline.text.slice(cursor, nextCursor), styles));
            cursor = nextCursor;
        }

        return restored;
    };

    return mapBlocksAsync(
        blocks,
        (content) => mapBlockContentAsync(content, restoreTextInline)
    );
}

function collectTagIds(blocks: BlockNote[]): string[] {
    const tagIds = new Set<string>();

    const visit = (items: BlockNote[]) => {
        for (const block of items) {
            visitBlockContent(block.content, (inline) => {
                if (inline.type === 'tag' && typeof inline.props?.id === 'string') {
                    tagIds.add(inline.props.id);
                }
            });

            if (block.children?.length) {
                visit(block.children);
            }
        }
    };

    visit(blocks);
    return [...tagIds];
}

let editorInstance: ServerBlockNoteEditor | null = null;

function getEditor(): ServerBlockNoteEditor {
    if (!editorInstance) {
        editorInstance = ServerBlockNoteEditor.create();
    }
    return editorInstance;
}

export async function blocksToMarkdown(contentJson: string): Promise<string> {
    try {
        const blocks = JSON.parse(contentJson);
        const supportedBlocks = stripUnsupportedMarkdownBlocks(blocks);
        const placeholderToTag = new Map<string, string>();
        const processed = preprocessCustomInlineContent(
            supportedBlocks,
            placeholderToTag,
            { value: 0 }
        );
        const editor = getEditor();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markdown = await editor.blocksToMarkdownLossy(processed as any);
        return restoreTagPlaceholdersInMarkdown(markdown, placeholderToTag);
    } catch {
        return '';
    }
}

export async function markdownToBlocksJson(
    markdown: string,
    deps: MarkdownImportDeps = defaultMarkdownImportDeps
): Promise<string> {
    const editor = getEditor();
    const preprocessedMarkdown = preprocessMarkdownExplicitTags(markdown);
    const blocks = await editor.tryParseMarkdownToBlocks(preprocessedMarkdown.markdown);
    const restoredBlocks = await restoreCustomInlineContent(
        blocks as BlockNote[],
        deps,
        preprocessedMarkdown.placeholderToTag
    );
    return JSON.stringify(
        restoreRemainingTagPlaceholders(restoredBlocks, preprocessedMarkdown.placeholderToTag)
    );
}

export function extractTagIdsFromContentJson(contentJson: string): string[] {
    const blocks = JSON.parse(contentJson) as BlockNote[];
    return collectTagIds(blocks);
}
