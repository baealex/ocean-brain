import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { useState } from 'react';
import type { TrashedNote } from '~/apis/note.api';
import {
    fetchBackReferences,
    fetchTrashedNote,
    fetchTrashedNotes,
    purgeTrashedNote,
    restoreTrashedNote,
} from '~/apis/note.api';
import { QueryBoundary } from '~/components/app';
import * as Icon from '~/components/icon';
import { NoteReferenceWarningModal } from '~/components/note';
import { Button, Empty, Modal, PageLayout, Pagination, Skeleton, SurfaceCard } from '~/components/shared';
import { Text, useConfirm, useToast } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE, SETTINGS_TRASH_ROUTE } from '~/modules/url';

const PAGE_SIZE = 25;
const Route = getRouteApi(SETTINGS_TRASH_ROUTE);
const TRASH_RETENTION_DAYS = 30;
const PAGE_DESCRIPTION = `Deleted notes stay here for ${TRASH_RETENTION_DAYS} days before permanent removal`;
const PERMANENT_DELETE_REFERENCE_WARNING = {
    title: 'Permanently delete note?',
    description:
        'This note is referenced by the notes below. If you permanently delete it, those links will stay broken. Other notes will not be edited automatically.',
    confirmLabel: 'Delete now',
    confirmVariant: 'danger' as const,
};

interface PurgeWarningState {
    id: string;
    backReferences: Pick<Note, 'id' | 'title'>[];
}

const formatDate = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm');

interface TrashedNoteContentModalProps {
    note: TrashedNote | null;
    onClose: () => void;
}

const TrashedNoteContentModal = ({ note, onClose }: TrashedNoteContentModalProps) => {
    const noteId = note?.id ?? '';
    const title = note?.title || 'Untitled note';
    const noteQuery = useQuery({
        queryKey: queryKeys.notes.trashDetail(noteId),
        enabled: Boolean(note),
        queryFn: async () => {
            const response = await fetchTrashedNote(noteId);

            if (response.type === 'error') {
                throw response;
            }

            if (!response.trashedNote) {
                throw new Error('Trashed note not found');
            }

            return response.trashedNote;
        },
    });
    const content = noteQuery.data?.contentAsMarkdown.trim() ?? '';

    return (
        <Modal isOpen={Boolean(note)} onClose={onClose} variant="inspect">
            <Modal.Header title={title} onClose={onClose} />
            <Modal.Body>
                <div className="flex flex-col gap-3">
                    {note && (
                        <Text as="p" variant="meta" tone="secondary">
                            Deleted {formatDate(note.deletedAt)}
                        </Text>
                    )}
                    {noteQuery.isLoading && (
                        <Text as="p" variant="meta" tone="secondary">
                            Loading deleted note content...
                        </Text>
                    )}
                    {noteQuery.isError && (
                        <Text as="p" variant="meta" tone="error">
                            Failed to load deleted note content.
                        </Text>
                    )}
                    {!noteQuery.isLoading && !noteQuery.isError && content && (
                        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3 text-sm leading-6 text-fg-secondary">
                            {content}
                        </pre>
                    )}
                    {!noteQuery.isLoading && !noteQuery.isError && !content && (
                        <Text
                            as="p"
                            variant="meta"
                            tone="secondary"
                            className="rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3"
                        >
                            No readable content was found for this deleted note.
                        </Text>
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const TrashSkeleton = () => (
    <PageLayout
        title="Trash"
        variant="default"
        heading={<Skeleton width={118} height={24} className="rounded-full" />}
        description={<Skeleton width={352} height={16} className="rounded-full" />}
    >
        <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, index) => (
                <SurfaceCard key={index} padding="compact">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton width="40%" height={18} className="rounded-full" />
                            <div className="flex flex-wrap gap-2">
                                <Skeleton width={168} height={14} className="rounded-full" />
                                <Skeleton width={176} height={14} className="rounded-full" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Skeleton width={56} height={24} className="rounded-full" />
                                <Skeleton width={72} height={24} className="rounded-full" />
                            </div>
                        </div>
                        <Skeleton width={92} height={32} className="rounded-[12px]" />
                    </div>
                </SurfaceCard>
            ))}
        </div>
    </PageLayout>
);

const TrashContent = () => {
    const { page } = Route.useSearch();
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();
    const confirm = useConfirm();
    const [selectedContentNoteId, setSelectedContentNoteId] = useState<string | null>(null);
    const [purgeWarningState, setPurgeWarningState] = useState<PurgeWarningState | null>(null);

    const { data } = useSuspenseQuery({
        queryKey: queryKeys.notes.trash({
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
        }),
        queryFn: async () => {
            const response = await fetchTrashedNotes({
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
            });

            if (response.type === 'error') {
                throw response;
            }

            return response.trashedNotes;
        },
    });

    const restoreMutation = useMutation({
        mutationFn: restoreTrashedNote,
        onSuccess: async (response) => {
            if (response.type === 'error') {
                throw response;
            }

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.all(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.tags.all(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.reminders.all(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.images.all(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.calendar.all(),
                    exact: false,
                }),
            ]);

            toast('The note has been restored.');
            navigate({
                to: NOTE_ROUTE,
                params: { id: response.restoreTrashedNote.id },
            });
        },
        onError: () => {
            toast('Failed to restore the note.');
        },
    });

    const purgeMutation = useMutation({
        mutationFn: purgeTrashedNote,
        onSuccess: async (response) => {
            if (response.type === 'error') {
                throw response;
            }

            await queryClient.invalidateQueries({
                queryKey: queryKeys.notes.trashAll(),
                exact: false,
            });

            toast('The note has been permanently deleted.');
        },
        onError: () => {
            toast('Failed to permanently delete the note.');
        },
    });

    const handlePurgeWarningConfirm = () => {
        if (!purgeWarningState) {
            return;
        }

        const { id } = purgeWarningState;
        setPurgeWarningState(null);
        purgeMutation.mutate(id);
    };

    const handlePurge = async (id: string) => {
        const backReferencesResponse = await fetchBackReferences(id);

        if (backReferencesResponse.type === 'error') {
            toast('Failed to check linked notes before permanently deleting this note.');
            return;
        }

        queryClient.setQueryData(queryKeys.notes.backReferences(id), backReferencesResponse.backReferences);

        if (backReferencesResponse.backReferences.length > 0) {
            setPurgeWarningState({
                id,
                backReferences: backReferencesResponse.backReferences,
            });
            return;
        }

        if (await confirm('Permanently delete this note? This cannot be undone.')) {
            purgeMutation.mutate(id);
        }
    };

    const heading = data.totalCount > 0 ? `Trash (${data.totalCount})` : undefined;
    const selectedContentNote = data.notes.find((note) => note.id === selectedContentNoteId) ?? null;

    if (data.notes.length === 0) {
        return (
            <PageLayout title="Trash" variant="default" heading={heading} description={PAGE_DESCRIPTION}>
                <Empty
                    title="Trash is empty"
                    description={`Delete a note and you can restore it here for ${TRASH_RETENTION_DAYS} days before permanent removal`}
                />
            </PageLayout>
        );
    }

    return (
        <PageLayout title="Trash" variant="default" heading={heading} description={PAGE_DESCRIPTION}>
            <div className="flex flex-col gap-4">
                <div className="grid gap-3">
                    {data.notes.map((note) => (
                        <SurfaceCard key={note.id} padding="compact">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-start gap-1.5">
                                        <Text
                                            as="h2"
                                            variant="body"
                                            weight="medium"
                                            className="min-w-0 flex-1 break-words leading-[1.25]"
                                        >
                                            {note.title || 'Untitled note'}
                                        </Text>
                                        {note.pinned && (
                                            <span
                                                title="Pinned"
                                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-fg-tertiary"
                                            >
                                                <Icon.Pin className="h-3.5 w-3.5" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <Text as="div" variant="meta" weight="medium" tone="secondary">
                                            Deleted {formatDate(note.deletedAt)}
                                        </Text>
                                    </div>
                                    {note.tagNames.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {note.tagNames.map((tagName) => (
                                                <Text
                                                    as="span"
                                                    key={`${note.id}-${tagName}`}
                                                    variant="label"
                                                    weight="medium"
                                                    tone="tertiary"
                                                    className="rounded-full border border-border-subtle bg-hover-subtle px-2 py-0.5"
                                                >
                                                    {tagName}
                                                </Text>
                                            ))}
                                        </div>
                                    )}
                                    {note.contentPreview && (
                                        <div className="mt-3 rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-3 py-2">
                                            <Text
                                                as="p"
                                                variant="meta"
                                                tone="secondary"
                                                className="line-clamp-3 whitespace-pre-wrap break-words"
                                            >
                                                {note.contentPreview}
                                            </Text>
                                        </div>
                                    )}
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                    <Button
                                        variant="subtle"
                                        size="sm"
                                        onClick={() => setSelectedContentNoteId(note.id)}
                                    >
                                        View content
                                    </Button>
                                    <Button
                                        variant="subtle"
                                        size="sm"
                                        isLoading={restoreMutation.isPending && restoreMutation.variables === note.id}
                                        onClick={() => restoreMutation.mutate(note.id)}
                                    >
                                        Restore
                                    </Button>
                                    <Button
                                        variant="soft-danger"
                                        size="sm"
                                        isLoading={purgeMutation.isPending && purgeMutation.variables === note.id}
                                        onClick={() => handlePurge(note.id)}
                                    >
                                        Delete now
                                    </Button>
                                </div>
                            </div>
                        </SurfaceCard>
                    ))}
                </div>
                {data.totalCount > PAGE_SIZE && (
                    <Pagination
                        page={page}
                        last={Math.ceil(data.totalCount / PAGE_SIZE)}
                        onChange={(nextPage) => {
                            navigate({
                                search: (prev) => ({
                                    ...prev,
                                    page: nextPage,
                                }),
                            });
                        }}
                    />
                )}
            </div>
            <TrashedNoteContentModal note={selectedContentNote} onClose={() => setSelectedContentNoteId(null)} />
            <NoteReferenceWarningModal
                isOpen={Boolean(purgeWarningState)}
                title={PERMANENT_DELETE_REFERENCE_WARNING.title}
                description={PERMANENT_DELETE_REFERENCE_WARNING.description}
                references={purgeWarningState?.backReferences ?? []}
                confirmLabel={PERMANENT_DELETE_REFERENCE_WARNING.confirmLabel}
                confirmVariant={PERMANENT_DELETE_REFERENCE_WARNING.confirmVariant}
                onClose={() => setPurgeWarningState(null)}
                onConfirm={handlePurgeWarningConfirm}
            />
        </PageLayout>
    );
};

const Trash = () => {
    const { page } = Route.useSearch();

    return (
        <QueryBoundary
            fallback={<TrashSkeleton />}
            errorTitle="Failed to load trash"
            errorDescription="Retry loading deleted notes"
            resetKeys={[page]}
        >
            <TrashContent />
        </QueryBoundary>
    );
};

export default Trash;
