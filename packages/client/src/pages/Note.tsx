import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import classNames from 'classnames';

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
import { NOTE_ROUTE, SETTINGS_TRASH_ROUTE } from '~/modules/url';

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

const noteMetaTextClassName = 'text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-fg-tertiary';

interface NoteContentProps {
    id: string;
}

function NoteContent({ id }: NoteContentProps) {
    const toast = useToast();
    const navigate = Route.useNavigate();
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
                    className="surface-floating sticky top-20 mb-8 rounded-[20px] border border-border-subtle px-5 py-4">
                    <div className="mb-3 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-fg-tertiary">
                                Thought in progress
                            </div>
                            <input
                                ref={titleRef}
                                placeholder="Title"
                                className="w-full bg-transparent text-[1.4rem] font-semibold tracking-[-0.02em] outline-none"
                                type="text"
                                value={title}
                                onChange={(event) => handleTitleChange(event.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Dropdown
                                button={(
                                    <button
                                        type="button"
                                        className="focus-ring-soft inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-transparent bg-transparent text-fg-tertiary outline-none transition-colors hover:border-border-subtle hover:bg-hover-subtle hover:text-fg-default">
                                        <Icon.VerticalDots className="h-5 w-5" />
                                        <span className="sr-only">Note actions</span>
                                    </button>
                                )}
                                items={[
                                    {
                                        name: isPinned ? 'Unpin' : 'Pin',
                                        onClick: () => onPinned(id, isPinned, () => {
                                            setIsPinned(prev => !prev);
                                        })
                                    },
                                    {
                                        name: 'Change layout',
                                        onClick: () => setIsLayoutModalOpen(true)
                                    },
                                    { type: 'separator' },
                                    {
                                        name: 'Clone this note',
                                        onClick: () => onCreate(
                                            titleRef.current?.value || 'untitled',
                                            editorRef.current?.getContent() || '',
                                            layout
                                        )
                                    },
                                    {
                                        name: 'Restore previous version',
                                        onClick: () => setIsRestoreModalOpen(true)
                                    },
                                    { type: 'separator' },
                                    {
                                        name: 'Delete',
                                        onClick: () => onDelete(id, () => {
                                            navigate({
                                                to: SETTINGS_TRASH_ROUTE,
                                                search: { page: 1 }
                                            });
                                        })
                                    }
                                ]}
                            />
                            <Button
                                size="sm"
                                variant="ghost"
                                isLoading={isMountedEvent}
                                onClick={handleChange}>
                                Save
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {isPinned && (
                            <span className={`inline-flex items-center gap-1.5 ${noteMetaTextClassName}`}>
                                <Icon.Pin className="h-3 w-3" weight="fill" />
                                Pinned
                            </span>
                        )}
                        {isPinned && <span className={classNames('h-1 w-1 rounded-full bg-border-secondary')} />}
                        <span className={noteMetaTextClassName}>Saved {lastSavedAt}</span>
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
                            <div className="surface-base rounded-[20px] border border-border-subtle p-4">
                                <p className="mb-2 text-sm font-semibold">
                                    Back References
                                </p>
                                <ul className="flex flex-col gap-1 text-sm">
                                    {backReferences.map((backLink) => (
                                        <li key={backLink.id}>
                                            <Link
                                                to={NOTE_ROUTE}
                                                params={{ id: backLink.id }}
                                                className="block rounded-[10px] px-2.5 py-1.5 text-fg-secondary transition-colors hover:bg-hover-subtle hover:text-fg-default">
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
