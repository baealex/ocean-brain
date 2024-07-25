import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { insertOrUpdateBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useQuery } from 'react-query';

import schema, { CommandView, ReferenceView, TagView } from '~/components/schema';
import { Button, Container, Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';

import type { Note } from '~/models/Note';

import useDebounce from '~/hooks/useDebounce';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import { fileToBase64 } from '~/modules/file';
import { graphQuery } from '~/modules/graph-query';

import { useTheme } from '~/store/theme';

import { uploadImage } from '~/apis/image.api';
import { getNoteURL } from '~/modules/url';
import { toast } from '@baejino/ui';

export default function Note() {
    const { id } = useParams();

    const { theme } = useTheme(state => state);

    const titleRef = useRef<HTMLInputElement>(null);

    const [lastSavedAtMap, setLastSavedAtMap] = useState<Record<string, string>>({});

    const [isPinned, setIsPinned] = useState(false);
    const [isMountedEvent, mountEvent] = useDebounce(1000);

    const editor = useCreateBlockNote({
        schema,
        uploadFile: async (file) => uploadImage({ base64: await fileToBase64(file) })
    }, []);

    const { isLoading } = useQuery(['note', id], async () => {
        const { note } = await graphQuery<{
            note: Pick<Note, 'title' | 'content' | 'pinned'>;
        }>(`
            query {
                note(id: "${id}") {
                    title
                    pinned
                    content
                }
            }
        `);
        return note;
    }, {
        enabled: !!id,
        cacheTime: 0,
        onSuccess(note) {
            if (titleRef.current) {
                titleRef.current.value = note.title;
            }
            if (note.content) {
                const content = JSON.parse(note.content);
                editor.replaceBlocks(editor.document, content);
            }
            setIsPinned(note.pinned);
        }
    });

    const { data: backReferences } = useQuery(['backReferences', id], async () => {
        const { backReferences } = await graphQuery<{
            backReferences: Pick<Note, 'id' | 'title'>[];
        }>(`
            query {
                backReferences(id: "${id}") {
                    id
                    title
                }
            }
        `);

        return backReferences;
    }, { enabled: !!id });

    const save = async ({ title = '', content = '' }) => {
        if (!id || isLoading) {
            return;
        }
        mountEvent(async () => {
            await graphQuery<{
                updateNote: {
                    id: string;
                    title: string;
                    content: string;
                };
            }>(`
                mutation {
                    updateNote(id: "${id}", title: "${title}", content: "${encodeURIComponent(content)}") {
                        id
                        title
                        content
                    }
                }
            `);
            setLastSavedAtMap(prev => Object.assign({}, prev, { [id]: dayjs().format('YYYY-MM-DD HH:mm:ss') }));
        });
    };

    const handleChange = () => {
        save({
            title: titleRef.current?.value,
            content: JSON.stringify(editor?.document)
        });
    };
    const {
        onDelete,
        onPinned
    } = useNoteMutate();

    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            const item = e.clipboardData?.items[0];

            if (item && item.type.indexOf('text/html') !== -1) {
                const data = e.clipboardData?.getData('text/html');
                if (data.includes('<img')) {
                    const src = data.match(/src="(.*?)"/g)?.pop()?.replace(/src="(.*?)"/g, '$1') ?? '';
                    if (src && !src.startsWith(location.origin)) {
                        e.preventDefault();
                        const url = await uploadImage({ externalSrc: src });
                        insertOrUpdateBlock(editor!, {
                            type: 'image',
                            props: { url }
                        });
                    }
                }
            }

            if (item && item.type.indexOf('image') !== -1) {
                const imageFile = item.getAsFile();
                if (imageFile) {
                    const url = await uploadImage({ base64: await fileToBase64(imageFile) });
                    insertOrUpdateBlock(editor!, {
                        type: 'image',
                        props: { url }
                    });
                }
            }
        };

        window.addEventListener('paste', handlePaste, true);

        return () => window.removeEventListener('paste', handlePaste, true);
    }, [editor]);

    useEffect(() => {
        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            const items = e.dataTransfer?.items;
            if (items) {
                e.preventDefault();
                for (const item of items) {
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                            const url = await uploadImage({ base64: await fileToBase64(file) });
                            insertOrUpdateBlock(editor!, {
                                type: 'image',
                                props: { url }
                            });
                        }
                    }
                }
            }
        };

        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('drop', handleDrop);
        };
    }, [editor]);

    return (
        <Container>
            <Helmet>
                <title>{titleRef.current?.value}</title>
            </Helmet>
            <div
                style={{ zIndex: '1001' }}
                className="sticky top-0 mb-8 flex items-center justify-between gap-3 p-3 px-5 shadow-md border border-solid border-black dark:border-zinc-500 bg-white bg-opacity-75 dark:bg-black dark:bg-opacity-75">
                <div className="flex flex-col flex-1 gap-2">
                    <input
                        ref={titleRef}
                        placeholder="Title"
                        className="text-md font-extrabold outline-none bg-transparent w-full"
                        type="text"
                        onChange={handleChange}
                    />
                    {id && lastSavedAtMap[id] && (
                        <div className="text-zinc-500 text-sm">
                            Last saved at {lastSavedAtMap[id]}
                        </div>
                    )}
                </div>
                <div className="flex gap-3 items-center">
                    <Dropdown
                        button={(
                            <Icon.VerticalDots className="w-5 h-5" />
                        )}
                        items={[
                            {
                                name: isPinned ? 'Unpin' : 'Pin',
                                onClick: () => onPinned(id!, isPinned, () => {
                                    setIsPinned(prev => !prev);
                                })
                            },
                            {
                                name: 'Delete',
                                onClick: () => onDelete(id!, () => {
                                    toast('The note has been deleted.');
                                })
                            }
                        ]}
                    />
                    <Button
                        isLoading={isMountedEvent}
                        onClick={handleChange}>
                        Save
                    </Button>
                </div>
            </div>
            <BlockNoteView
                slashMenu={false}
                theme={theme}
                editor={editor}
                onChange={handleChange}>
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
            {backReferences && backReferences.length > 0 && (
                <div className=" shadow-xl p-5 rounded-2xl">
                    <p className="text-lg font-bold">
                        Back References
                    </p>
                    <ul>
                        {backReferences.map((backLink) => (
                            <li>
                                <Link to={getNoteURL(backLink.id)}>
                                    - {backLink.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Container >
    );
}
