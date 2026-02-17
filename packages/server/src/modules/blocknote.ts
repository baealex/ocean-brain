import { ServerBlockNoteEditor } from '@blocknote/server-util';

interface BlockNote {
    id?: string;
    type: string;
    props?: Record<string, unknown>;
    content?: BlockNote[];
    children?: BlockNote[];
    text?: string;
    styles?: Record<string, unknown>;
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
        const processed = preprocessCustomInlineContent(blocks);
        const editor = getEditor();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await editor.blocksToMarkdownLossy(processed as any);
    } catch {
        return '';
    }
}
