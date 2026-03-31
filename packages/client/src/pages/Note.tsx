import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';

import { QueryBoundary, QueryErrorView } from '~/components/app';
import { Button, Dropdown, PageLayout, Skeleton } from '~/components/shared';
import * as Icon from '~/components/icon';
import { useToast } from '~/components/ui';
import type { EditorRef } from '~/components/shared/Editor';
import Editor from '~/components/shared/Editor';
import { BackReferences } from '~/components/entities';
import { LayoutModal, RestoreSnapshotModal } from '~/components/note';
import { ReminderPanel } from '~/components/reminder';
import type { NoteLayout } from '~/models/note.model';
import useDebounce from '~/hooks/useDebounce';
import useNoteMutate from '~/hooks/resource/useNoteMutate';
import { fetchNote, updateNote } from '~/apis/note.api';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';

const Route = getRouteApi(NOTE_ROUTE);

const formatSavedAt = (updatedAt: string) => dayjs(Number(updatedAt)).format('YYYY-MM-DD HH:mm:ss');

const createEditSessionId = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const NOTE_LAYOUT_WIDTH: Record<NoteLayout, string> = {
    narrow: 'max-w-[640px]',
    wide: 'max-w-[896px]',
    full: 'max-w-full px-4'
};

const notePageFallback = (
    <PageLayout title="Loading note" variant="none">
        <main className="mx-auto max-w-[896px]">
            <Skeleton className="mb-8" height="66px" />
            <Skeleton className="ml-12 mb-8" height="150px" />
            <Skeleton className="mb-5" height="80px" />
            <Skeleton height="80px" />
        </main>
    </PageLayout>
);

interface NoteContentProps {
    id: string;
}

function NoteContent({ id }: NoteContentProps) {
    const toast = useToast();
    const editorRef = useRef<EditorRef>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const editSessionIdRef = useRef<string>(createEditSessionId());

    const { data: note } = useSuspenseQuery({
        queryKey: queryKeys.notes.detail(id),
        queryFn: async () => {
            const response = await fetchNote(id);
            if (response.type === 'error') {
                throw response;
            }
            return response.note;
        },
        gcTime: 0
    });

    const [title, setTitle] = useState(note.title);
    const [lastSavedAt, setLastSavedAt] = useState(() => formatSavedAt(note.updatedAt));
    const [isPinned, setIsPinned] = useState(note.pinned);
    const [layout, setLayout] = useState<NoteLayout>(note.layout || 'wide');
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [isMountedEvent, mountEvent] = useDebounce(1000);

    useEffect(() => {
        setTitle(note.title);
        setIsPinned(note.pinned);
        setLayout(note.layout || 'wide');
        setLastSavedAt(formatSavedAt(note.updatedAt));
    }, [note.layout, note.pinned, note.title, note.updatedAt]);

    useEffect(() => {
        editSessionIdRef.current = createEditSessionId();
    }, [id]);

    const save = async ({
        title: nextTitle = '',
        content = ''
    }) => {
        mountEvent(async () => {
            const response = await updateNote({
                id,
                title: nextTitle,
                content,
                editSessionId: editSessionIdRef.current
            });

            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }

            setTitle(nextTitle);
            setLastSavedAt(dayjs().format('YYYY-MM-DD HH:mm:ss'));
        });
    };

    const handleChange = () => {
        save({
            title,
            content: editorRef.current?.getContent()
        });
    };

    const handleTitleChange = (nextTitle: string) => {
        setTitle(nextTitle);
        save({
            title: nextTitle,
            content: editorRef.current?.getContent()
        });
    };

    const handleLayoutSave = async (newLayout: NoteLayout) => {
        const response = await updateNote({
            id,
            layout: newLayout,
            editSessionId: editSessionIdRef.current
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

    return (
        <PageLayout title={title} variant="none">
            <main className={`mx-auto ${NOTE_LAYOUT_WIDTH[layout]}`}>
                <div
                    style={{ zIndex: '1001' }}
                    className="sticky top-20 mb-8 flex items-center justify-between gap-3 p-3 px-4 border-2 border-border rounded-sketchy-lg bg-surface/90 backdrop-blur-sm shadow-sketchy">
                    <div className="flex flex-col flex-1 gap-1">
                        <input
                            ref={titleRef}
                            placeholder="Title"
                            className="text-md font-bold outline-none bg-transparent w-full"
                            type="text"
                            value={title}
                            onChange={(event) => handleTitleChange(event.target.value)}
                        />
                        {lastSavedAt && (
                            <div className="text-fg-placeholder text-xs">
                                Last saved at {lastSavedAt}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        <Dropdown
                            button={(
                                <Icon.VerticalDots className="w-5 h-5" />
                            )}
                            items={[
                                {
                                    name: isPinned ? 'Unpin' : 'Pin',
                                    onClick: () => onPinned(id, isPinned, () => {
                                        setIsPinned(prev => !prev);
                                    })
                                },
                                {
                                    name: 'Clone this note',
                                    onClick: () => onCreate(
                                        titleRef.current?.value || 'untitled',
                                        editorRef.current?.getContent() || '',
                                        layout
                                    )
                                },
                                {
                                    name: 'Delete',
                                    onClick: () => onDelete(id, () => {
                                        toast('The note has been deleted.');
                                    })
                                },
                                {
                                    name: 'Restore previous version',
                                    onClick: () => setIsRestoreModalOpen(true)
                                },
                                {
                                    name: 'Change layout',
                                    onClick: () => setIsLayoutModalOpen(true)
                                }
                            ]}
                        />
                        <Button
                            size="sm"
                            isLoading={isMountedEvent}
                            onClick={handleChange}>
                            Save
                        </Button>
                    </div>
                </div>

                <Editor
                    key={`${id}:${note.updatedAt}`}
                    ref={editorRef}
                    content={note.content}
                    onChange={handleChange}
                />

                <QueryBoundary
                    fallback={<Skeleton className="mb-5" height="80px" />}
                    errorTitle="Failed to load reminders"
                    errorDescription="Retry loading reminder details for this note."
                    renderError={({ error, retry }) => (
                        <QueryErrorView
                            title="Failed to load reminders"
                            description="Retry loading reminder details for this note."
                            error={error}
                            onRetry={retry}
                            showBackAction={false}
                            showHomeAction={false}
                        />
                    )}>
                    <ReminderPanel noteId={id} />
                </QueryBoundary>

                <QueryBoundary
                    fallback={<Skeleton height="80px" />}
                    errorTitle="Failed to load back references"
                    errorDescription="Retry loading notes that link back here."
                    renderError={({ error, retry }) => (
                        <QueryErrorView
                            title="Failed to load back references"
                            description="Retry loading notes that link back here."
                            error={error}
                            onRetry={retry}
                            showBackAction={false}
                            showHomeAction={false}
                        />
                    )}>
                    <BackReferences
                        noteId={id}
                        render={backReferences => backReferences && backReferences.length > 0 && (
                            <div className="p-4 rounded-sketchy-lg border-2 border-border bg-surface/50">
                                <p className="text-sm font-bold mb-2">
                                    Back References
                                </p>
                                <ul className="text-sm flex flex-col gap-1">
                                    {backReferences.map((backLink) => (
                                        <li key={backLink.id}>
                                            <Link
                                                to={NOTE_ROUTE}
                                                params={{ id: backLink.id }}
                                                className="block px-2 py-1 rounded-sketchy-sm text-fg-secondary hover:bg-hover transition-colors">
                                                - {backLink.title}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    />
                </QueryBoundary>

                <LayoutModal
                    isOpen={isLayoutModalOpen}
                    onClose={() => setIsLayoutModalOpen(false)}
                    onSave={handleLayoutSave}
                    currentLayout={layout}
                />
                <RestoreSnapshotModal
                    isOpen={isRestoreModalOpen}
                    noteId={id}
                    onClose={() => setIsRestoreModalOpen(false)}
                    onRestored={() => {
                        editSessionIdRef.current = createEditSessionId();
                    }}
                />
            </main>
        </PageLayout>
    );
}

export default function Note() {
    const { id } = Route.useParams();

    if (!id) {
        throw new Error('Note id is required.');
    }

    return (
        <QueryBoundary
            fallback={notePageFallback}
            errorTitle="Failed to load note"
            errorDescription="Retry loading the note editor."
            resetKeys={[id]}
            renderError={({ error, retry }) => (
                <PageLayout title="Note" variant="none">
                    <QueryErrorView
                        title="Failed to load note"
                        description="Retry loading the note editor."
                        error={error}
                        onRetry={retry}
                    />
                </PageLayout>
            )}>
            <NoteContent key={id} id={id} />
        </QueryBoundary>
    );
}
