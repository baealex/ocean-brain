import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { forwardRef, useImperativeHandle } from 'react';
import { uploadImage } from '~/apis/image.api';
import schema, { CommandView, ReferenceView, TagView } from '~/components/schema';
import {
    type MarkdownBlock,
    prepareBlocksForMarkdown,
    restoreTagPlaceholdersInMarkdown,
} from '~/modules/blocknote-markdown';
import { fileToBase64 } from '~/modules/file';
import { useTheme } from '~/store/theme';

interface EditorProps {
    content?: string;
    currentNoteId?: string;
    editable?: boolean;
    onChange?: () => void;
}

export interface EditorRef {
    getContent: () => string;
    getMarkdown: () => string;
    getHtml: () => string;
}

const Editor = forwardRef<EditorRef, EditorProps>(({ content, currentNoteId, editable, onChange }, ref) => {
    const { theme } = useTheme((state) => state);

    const editor = useCreateBlockNote(
        {
            schema,
            initialContent: (content && JSON.parse(content)) || undefined,
            uploadFile: async (file) => uploadImage({ base64: await fileToBase64(file) }),
        },
        [],
    );

    useImperativeHandle(ref, () => {
        return {
            getContent: () => {
                return JSON.stringify(editor.document);
            },
            getMarkdown: () => {
                const prepared = prepareBlocksForMarkdown(editor.document as unknown as MarkdownBlock[]);
                const markdown = editor.blocksToMarkdownLossy(
                    prepared.blocks as Parameters<typeof editor.blocksToMarkdownLossy>[0],
                );

                return restoreTagPlaceholdersInMarkdown(markdown, prepared.placeholderToTag);
            },
            getHtml: () => {
                return editor.blocksToHTMLLossy(editor.document);
            },
        };
    });

    return (
        <BlockNoteView slashMenu={false} theme={theme} editor={editor} editable={editable} onChange={onChange}>
            <CommandView editor={editor} />
            <ReferenceView
                currentNoteId={currentNoteId}
                onClick={(content) => {
                    editor.insertInlineContent([content, ' ']);
                }}
            />
            <TagView
                onClick={(content) => {
                    editor.insertInlineContent([content, ' ']);
                }}
            />
        </BlockNoteView>
    );
});

export default Editor;
