import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { forwardRef, useImperativeHandle } from 'react';
import { uploadImage } from '~/apis/image.api';
import schema, { CommandView, ReferenceView, TagView } from '~/components/schema';
import { fileToBase64 } from '~/modules/file';
import { useTheme } from '~/store/theme';

interface EditorProps {
    content: string;
    onChange: () => void;
}

export interface EditorRef {
    getContent: () => string;
}

const Editor = forwardRef<EditorRef, EditorProps>(({ content, onChange }, ref) => {
    const { theme } = useTheme(state => state);

    const editor = useCreateBlockNote({
        schema,
        initialContent: (content && JSON.parse(content)) || undefined,
        uploadFile: async (file) => uploadImage({ base64: await fileToBase64(file) })
    }, []);

    useImperativeHandle(ref, () => {
        return {
            getContent: () => {
                return JSON.stringify(editor.document);
            }
        };
    });

    return (
        <BlockNoteView
            slashMenu={false}
            theme={theme}
            editor={editor}
            onChange={onChange}>
            <CommandView editor={editor} />
            <ReferenceView
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
