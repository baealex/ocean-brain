import dayjs from 'dayjs';
import { Suspense, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useQuery } from 'react-query';

import { Button, Container, Dropdown, Skeleton } from '~/components/shared';
import * as Icon from '~/components/icon';

import type { Note } from '~/models/Note';

import useDebounce from '~/hooks/useDebounce';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import { graphQuery } from '~/modules/graph-query';

import { getNoteURL } from '~/modules/url';
import { toast } from '@baejino/ui';

import type { EditorRef } from '~/components/shared/Editor';
import Editor from '~/components/shared/Editor';
import { BackReferences } from '~/components/entities';

export default function Note() {
    const { id } = useParams();

    const editorRef = useRef<EditorRef>(null);
    const titleRef = useRef<HTMLInputElement>(null);

    const [lastSavedAtMap, setLastSavedAtMap] = useState<Record<string, string>>({});

    const [isPinned, setIsPinned] = useState(false);
    const [isMountedEvent, mountEvent] = useDebounce(1000);

    const { data: note, isLoading } = useQuery(['note', id], async () => {
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
        onSuccess(data) {
            setIsPinned(data.pinned);
        }
    });

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
            content: editorRef?.current?.getContent()
        });
    };
    const {
        onCreate,
        onDelete,
        onPinned
    } = useNoteMutate();

    return (
        <Container>
            <Helmet>
                <title>{titleRef.current?.value}</title>
            </Helmet>
            {isLoading && (
                <>
                    <Skeleton className="mb-8" height="66px" />
                    <Skeleton className="ml-12 mb-8" height="150px" />
                </>
            )}
            {note && (
                <>
                    <div
                        style={{ zIndex: '1001' }}
                        className="sticky top-4 mb-8 flex items-center justify-between gap-3 p-3 px-5 shadow-md border border-solid border-black dark:border-zinc-500 bg-white bg-opacity-75 dark:bg-zinc-900 dark:bg-opacity-75">
                        <div className="flex flex-col flex-1 gap-2">
                            <input
                                ref={titleRef}
                                placeholder="Title"
                                className="text-md font-extrabold outline-none bg-transparent w-full"
                                type="text"
                                defaultValue={note.title}
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
                                        name: 'Clone this note',
                                        onClick: () => onCreate(
                                            '[Clone] ' + (titleRef.current?.value || 'untitled'),
                                            encodeURIComponent(editorRef?.current?.getContent() || '')
                                        )
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
                    <Editor
                        ref={editorRef}
                        content={note.content}
                        onChange={handleChange}
                    />
                </>
            )}
            <Suspense
                fallback={(
                    <Skeleton height="100px" />
                )}>
                <BackReferences
                    noteId={id}
                    render={backReferences => backReferences && backReferences.length > 0 && (
                        <div className="shadow-xl p-5 rounded-2xl">
                            <p className="text-lg font-bold">
                                Back References
                            </p>
                            <ul>
                                {backReferences?.map((backLink) => (
                                    <li>
                                        <Link to={getNoteURL(backLink.id)}>
                                            - {backLink.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                />
            </Suspense>
        </Container>
    );
}
