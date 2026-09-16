import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import '@blocknote/mantine/style.css';
import {
    forwardRef,
    type ClipboardEvent as ReactClipboardEvent,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
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
import { findUnchangedBlock, getNoteReview, type NoteReviewEntry } from '~/modules/note-content-changes';
import { useTheme } from '~/store/theme';
import { ExternalChangeExtension } from './external-change-extension';

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
    applyExternalContent: (content: string) => void;
}

const Editor = forwardRef<EditorRef, EditorProps>(({ content, currentNoteId, editable, onChange }, ref) => {
    const { theme } = useTheme((state) => state);
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const reviewBaselineRef = useRef<string | null>(null);
    const applyingExternalRef = useRef(false);
    const externalContentRef = useRef<string | null>(null);
    const scrollPositionsRef = useRef<{ element: Element; top: number; left: number }[]>([]);
    const scrollAnchorRef = useRef<{ id: string; top: number; scroller: Element } | null>(null);
    const [changes, setChanges] = useState<NoteReviewEntry[] | null>(null);

    const editor = useCreateBlockNote(
        {
            schema,
            extensions: [ExternalChangeExtension()],
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

    const clearChanges = () => {
        if (reviewBaselineRef.current === null) return;
        reviewBaselineRef.current = null;
        editor.getExtension(ExternalChangeExtension)?.setReview([]);
        setChanges(null);
    };

    const restorePreviousContent = () => {
        const baseline = reviewBaselineRef.current;
        if (baseline === null) return;

        applyingExternalRef.current = true;
        try {
            editor.replaceBlocks(editor.document, JSON.parse(baseline || '[]'));
            externalContentRef.current = JSON.stringify(editor.document);
            reviewBaselineRef.current = null;
            editor.getExtension(ExternalChangeExtension)?.setReview([]);
            setChanges(null);
        } finally {
            applyingExternalRef.current = false;
        }
        onChange?.();
    };

    useImperativeHandle(ref, () => {
        return {
            applyExternalContent: (nextContent) => {
                const previousContent = JSON.stringify(editor.document);
                reviewBaselineRef.current ??= previousContent;
                const nextChanges = getNoteReview(reviewBaselineRef.current, nextContent);
                const positions = [];
                for (let element: Element | null = containerRef.current; element; element = element.parentElement) {
                    positions.push({ element, top: element.scrollTop, left: element.scrollLeft });
                }
                scrollPositionsRef.current = positions;
                const scroller = positions.find(
                    ({ element }) =>
                        element.scrollHeight > element.clientHeight &&
                        /auto|scroll/.test(getComputedStyle(element).overflowY),
                )?.element;
                if (scroller) {
                    const viewport = scroller.getBoundingClientRect();
                    const blockIds = new Set(editor.document.map((block) => block.id));
                    const visibleBlock = Array.from(
                        containerRef.current?.querySelectorAll<HTMLElement>('.bn-block-content') ?? [],
                    ).find((element) => {
                        const rect = element.getBoundingClientRect();
                        return (
                            rect.bottom > viewport.top &&
                            rect.top < viewport.bottom &&
                            blockIds.has(element.closest('[data-id]')?.getAttribute('data-id') ?? '')
                        );
                    });
                    const oldId = visibleBlock?.closest('[data-id]')?.getAttribute('data-id');
                    const nextId = oldId && findUnchangedBlock(previousContent, nextContent, oldId);
                    scrollAnchorRef.current =
                        visibleBlock && nextId
                            ? { id: nextId, top: visibleBlock.getBoundingClientRect().top, scroller }
                            : null;
                }
                applyingExternalRef.current = true;
                try {
                    if (previousContent !== nextContent) {
                        editor.transact((transaction) => {
                            transaction.setMeta('addToHistory', false);
                            editor.replaceBlocks(editor.document, JSON.parse(nextContent || '[]'));
                        });
                    }
                    externalContentRef.current = JSON.stringify(editor.document);
                    if (nextChanges.length === 0) reviewBaselineRef.current = null;
                    editor.getExtension(ExternalChangeExtension)?.setReview(nextChanges, {
                        onRestore: restorePreviousContent,
                        onReviewed: clearChanges,
                    });
                    setChanges(nextChanges.length ? nextChanges : null);
                } finally {
                    applyingExternalRef.current = false;
                }
            },
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

    useLayoutEffect(() => {
        for (const { element, top, left } of scrollPositionsRef.current) {
            element.scrollTop = top;
            element.scrollLeft = left;
        }
        const anchor = scrollAnchorRef.current;
        if (anchor) {
            const target = containerRef.current?.querySelector<HTMLElement>(
                `.bn-block[data-id="${CSS.escape(anchor.id)}"] > .bn-block-content`,
            );
            if (target) anchor.scroller.scrollTop += target.getBoundingClientRect().top - anchor.top;
        }
        scrollAnchorRef.current = null;
        scrollPositionsRef.current = [];
    }, [changes]);

    const handleChange = () => {
        if (applyingExternalRef.current || JSON.stringify(editor.document) === externalContentRef.current) return;
        externalContentRef.current = null;
        clearChanges();
        onChange?.();
    };

    const handleClipboardWrite = (event: ReactClipboardEvent) => {
        normalizeBlockNoteCopy(event.clipboardData);
    };

    return (
        <div ref={containerRef} className="relative">
            <BlockNoteView
                slashMenu={false}
                theme={theme}
                editor={editor}
                editable={editable}
                onChange={handleChange}
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
        </div>
    );
});

export default Editor;
