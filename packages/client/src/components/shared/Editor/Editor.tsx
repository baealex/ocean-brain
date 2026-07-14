import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { forwardRef, type ClipboardEvent as ReactClipboardEvent, useImperativeHandle } from 'react';
import { uploadImage } from '~/apis/image.api';
import schema, { CommandView, ReferenceView, TagView } from '~/components/schema';
import { useToast } from '~/components/ui';
import {
    formatBlockNoteMarkdownForExport,
    handleBlockNotePaste,
    normalizeBlockNoteCopy,
} from '~/modules/blocknote-clipboard';
import {
    type MarkdownBlock,
    prepareBlocksForMarkdown,
    restoreTagPlaceholdersInMarkdown,
} from '~/modules/blocknote-markdown';
import { fileToBase64 } from '~/modules/file';
import {
    FAILED_IMAGE_UPLOAD_MESSAGE,
    isSupportedImageUploadType,
    UNSUPPORTED_IMAGE_UPLOAD_MESSAGE,
} from '~/modules/image-upload-policy';
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
    const toast = useToast();

    const editor = useCreateBlockNote(
        {
            schema,
            initialContent: (content && JSON.parse(content)) || undefined,
            pasteHandler: (context) => handleBlockNotePaste(context),
            uploadFile: async (file, blockId) => {
                const removePendingBlock = () => {
                    if (blockId && editor.getBlock(blockId)) {
                        editor.removeBlocks([blockId]);
                    }
                };

                if (!isSupportedImageUploadType(file.type)) {
                    removePendingBlock();
                    toast(UNSUPPORTED_IMAGE_UPLOAD_MESSAGE);
                    throw new Error(UNSUPPORTED_IMAGE_UPLOAD_MESSAGE);
                }

                try {
                    return await uploadImage({ base64: await fileToBase64(file) });
                } catch (error) {
                    removePendingBlock();
                    toast(FAILED_IMAGE_UPLOAD_MESSAGE);
                    throw error;
                }
            },
        },
        [toast],
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

                return formatBlockNoteMarkdownForExport(
                    restoreTagPlaceholdersInMarkdown(markdown, prepared.placeholderToTag),
                );
            },
            getHtml: () => {
                return editor.blocksToHTMLLossy(editor.document);
            },
        };
    });

    const handleClipboardWrite = (event: ReactClipboardEvent) => {
        normalizeBlockNoteCopy(event.clipboardData);
    };

    return (
        <BlockNoteView
            slashMenu={false}
            theme={theme}
            editor={editor}
            editable={editable}
            onChange={onChange}
            onCopy={handleClipboardWrite}
            onCut={handleClipboardWrite}
        >
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
