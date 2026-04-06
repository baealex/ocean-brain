import { ServerBlockNoteEditor } from '@blocknote/server-util';

import models from '~/models.js';
import { ensureTagByName } from './tag-organization.js';

interface BlockNote {
    id?: string;
    type: string;
    props?: Record<string, unknown>;
    content?: BlockNoteInline[];
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

function preprocessCustomInlineContent(blocks: BlockNote[]): BlockNote[] {
    return blocks.map((block) => ({
        ...block,
        content: block.content?.map((inline) => {
            if (inline.type === 'reference') {
                return {
                    type: 'text',
                    text: `[[${inline.props?.title || inline.props?.id || ''}]]`,
                    styles: {}
                };
            }
            if (inline.type === 'tag') {
                const tag = (inline.props?.tag as string)?.replace(/^@/, '') || '';
                return {
                    type: 'text',
                    text: `#${tag}`,
                    styles: {}
                };
            }
            return inline;
        }),
        children: block.children?.length
            ? preprocessCustomInlineContent(block.children)
            : []
    }));
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
    deps: MarkdownImportDeps
): Promise<BlockNote[]> {
    const tagCache = new Map<string, Promise<{ id: string; tag: string }>>();
    const noteCache = new Map<string, Promise<Array<{ id: string; title: string }>>>();

    const getTag = (token: string) => {
        let existing = tagCache.get(token);

        if (!existing) {
            existing = deps.ensureTag(token.slice(1)).then((result) => ({
                id: 'tag' in result ? result.tag.id : result.id,
                tag: 'tag' in result ? result.tag.name : result.name
            }));
            tagCache.set(token, existing);
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
            if (
                inline.text.startsWith('[[', cursor)
            ) {
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

            if (
                inline.text[cursor] === '#' &&
                (cursor === 0 || /\s/.test(inline.text[cursor - 1]))
            ) {
                const remainder = inline.text.slice(cursor);
                const tagMatch = remainder.match(/^#[^\s[\]]+/);

                if (tagMatch) {
                    const tag = await getTag(tagMatch[0]);
                    appendInline(restored, {
                        type: 'tag',
                        props: tag
                    });
                    cursor += tagMatch[0].length;
                    continue;
                }
            }

            let nextCursor = cursor + 1;

            while (
                nextCursor < inline.text.length &&
                !inline.text.startsWith('[[', nextCursor) &&
                !(
                    inline.text[nextCursor] === '#' &&
                    /\s/.test(inline.text[nextCursor - 1] ?? '')
                )
            ) {
                nextCursor += 1;
            }

            appendInline(restored, createTextInline(inline.text.slice(cursor, nextCursor), styles));
            cursor = nextCursor;
        }

        return restored;
    };

    return Promise.all(
        blocks.map(async (block) => ({
            ...block,
            content: block.content
                ? (await Promise.all(block.content.map((inline) => restoreTextInline(inline)))).flat()
                : undefined,
            children: block.children?.length
                ? await restoreCustomInlineContent(block.children, deps)
                : []
        }))
    );
}

function collectTagIds(blocks: BlockNote[]): string[] {
    const tagIds = new Set<string>();

    const visit = (items: BlockNote[]) => {
        for (const block of items) {
            for (const inline of block.content ?? []) {
                if (inline.type === 'tag' && typeof inline.props?.id === 'string') {
                    tagIds.add(inline.props.id);
                }
            }

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
        const processed = preprocessCustomInlineContent(supportedBlocks);
        const editor = getEditor();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await editor.blocksToMarkdownLossy(processed as any);
    } catch {
        return '';
    }
}

export async function markdownToBlocksJson(
    markdown: string,
    deps: MarkdownImportDeps = defaultMarkdownImportDeps
): Promise<string> {
    const editor = getEditor();
    const blocks = await editor.tryParseMarkdownToBlocks(markdown);
    const restoredBlocks = await restoreCustomInlineContent(blocks as BlockNote[], deps);
    return JSON.stringify(restoredBlocks);
}

export function extractTagIdsFromContentJson(contentJson: string): string[] {
    const blocks = JSON.parse(contentJson) as BlockNote[];
    return collectTagIds(blocks);
}
