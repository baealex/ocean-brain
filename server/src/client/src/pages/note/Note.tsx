import dayjs from 'dayjs';
import { Suspense, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@baejino/ui';

import { Button, Dropdown, Skeleton } from '~/shared/ui';
import * as Icon from '~/shared/ui/icon';

import type { Note, NoteLayout } from '~/entities/note/model/note.model';

import useDebounce from '~/shared/hooks/useDebounce';
import useNoteMutate from '~/shared/hooks/resource/useNoteMutate';

import { graphQuery } from '~/shared/lib/graph-query';
import { getNoteURL } from '~/shared/lib/url';

import type { EditorRef } from '~/shared/ui/Editor';
import Editor from '~/shared/ui/Editor';
// import { BackReferences } from '~/entities/...' - TODO: implement hook
import { ReminderPanel } from '~/widgets/reminders-list';
import { LayoutModal } from '~/entities/note/ui';

import { updateNote } from '~/entities/note';

export default function Note() {
    const { id } = useParams();
    const navigation = useNavigate();

    const editorRef = useRef<EditorRef>(null);
    const titleRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState('');
    const [lastSavedAtMap, setLastSavedAtMap] = useState<Record<string, string>>({});

    const [isPinned, setIsPinned] = useState(false);
    const [layout, setLayout] = useState<NoteLayout>('wide');
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [isMountedEvent, mountEvent] = useDebounce(1000);

    const { data: note, isError, isLoading } = useQuery({
        queryKey: ['note', id],
        async queryFn() {
            const response = await graphQuery<{
                note: Pick<Note, 'title' | 'content' | 'pinned' | 'layout' | 'updatedAt'>;
            }>(`
                query {
                    note(id: "${id}") {
                        title
                        pinned
                        layout
                        content
                        updatedAt
                    }
                }
            `);
            if (response.type === 'error') {
                toast(response.errors[0].message);
                throw response;
            }
            setTitle(response.note.title);
            setIsPinned(response.note.pinned);
            setLayout(response.note.layout || 'wide');
            setLastSavedAtMap(prev => Object.assign({}, prev, { [id!]: dayjs(Number(response.note.updatedAt)).format('YYYY-MM-DD HH:mm:ss') }));
            return response.note;

        },
        enabled: !!id,
        gcTime: 0
    });

    const save = async ({ title = '', content = '' }) => {
        if (!id || isLoading) {
            return;
        }
        mountEvent(async () => {
            const response = await updateNote({
                id,
                title,
                content
            });

            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }
            setTitle(title);
            setLastSavedAtMap(prev => Object.assign({}, prev, { [id]: dayjs().format('YYYY-MM-DD HH:mm:ss') }));
        });
    };

    const handleChange = () => {
        save({
            title: titleRef.current?.value,
            content: editorRef?.current?.getContent()
        });
    };

    const handleLayoutSave = async (newLayout: NoteLayout) => {
        if (!id || isLoading) {
            return;
        }
        const response = await updateNote({
            id,
            layout: newLayout
        });

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }
        setLayout(newLayout);
        toast('Layout has been updated.');
    };

    const {
        onCreate,
        onDelete,
        onPinned
    } = useNoteMutate();

    if (isError) {
        return (
            <div className="h-full flex justify-center items-center">
                <div onClick={() => navigation(-1)} className="flex justify-center items-center gap-2 cursor-pointer animate-bounce">
                    <Icon.ChevronLeft className="w-6" />
                    <div className="font-bold text-lg">
                        take you back
                    </div>
                </div>
            </div>
        );
    }

    const getMaxWidth = () => {
        switch (layout) {
            case 'narrow':
                return 'max-w-[640px]';
            case 'wide':
                return 'max-w-[896px]';
            case 'full':
                return 'max-w-full px-4';
            default:
                return 'max-w-[896px]';
        }
    };

    return (
        <main className={`mx-auto ${getMaxWidth()}`}>
            <Helmet>
                <title>{title}</title>
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
                        className="sticky top-20 mb-8 flex items-center justify-between gap-3 p-3 px-5 shadow-md border border-solid border-black dark:border-zinc-500 bg-white bg-opacity-75 dark:bg-zinc-900 dark:bg-opacity-75">
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
                                            titleRef.current?.value || 'untitled',
                                            editorRef?.current?.getContent() || '',
                                            layout
                                        )
                                    },
                                    {
                                        name: 'Delete',
                                        onClick: () => onDelete(id!, () => {
                                            toast('The note has been deleted.');
                                        })
                                    },
                                    {
                                        name: 'Change layout',
                                        onClick: () => setIsLayoutModalOpen(true)
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
            {id && (
                <Suspense fallback={<Skeleton height="100px" />}>
                    <ReminderPanel noteId={id} />
                </Suspense>
            )}
            <Suspense
                fallback={(
                    <Skeleton height="100px" />
                )}>
                {/* TODO: BackReferences component */}
            </Suspense>
            <LayoutModal
                isOpen={isLayoutModalOpen}
                onClose={() => setIsLayoutModalOpen(false)}
                onSave={handleLayoutSave}
                currentLayout={layout}
            />
        </main>
    );
}
