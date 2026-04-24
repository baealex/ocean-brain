import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
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
import {
    Button,
    Empty,
    Modal,
    ModalActionRow,
    PageLayout,
    Pagination,
    Skeleton,
    SurfaceCard,
} from '~/components/shared';
import { Checkbox, Label, Text, useConfirm, useToast } from '~/components/ui';
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
const BULK_DELETE_MODAL_COPY = {
    confirmLabel: 'Delete selected',
};

interface PurgeWarningState {
    id: string;
    backReferences: Pick<Note, 'id' | 'title'>[];
}

interface BulkPurgeCandidate {
    id: string;
    title: string;
    backReferenceCount: number;
}

const formatDate = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm');
const formatNoteCount = (count: number) => `${count} ${count === 1 ? 'note' : 'notes'}`;

interface TrashedNoteContentModalProps {
    note: TrashedNote | null;
    onClose: () => void;
}

interface TrashedNotesBulkDeleteModalProps {
    candidates: BulkPurgeCandidate[];
    isDeleting: boolean;
    onClose: () => void;
    onConfirm: () => void;
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

const TrashedNotesBulkDeleteModal = ({
    candidates,
    isDeleting,
    onClose,
    onConfirm,
}: TrashedNotesBulkDeleteModalProps) => {
    const referencedCandidates = candidates.filter((candidate) => candidate.backReferenceCount > 0);
    const selectedNoteCountLabel = formatNoteCount(candidates.length);
    const title = `Permanently delete selected ${candidates.length === 1 ? 'note' : 'notes'}?`;
    const description =
        referencedCandidates.length > 0
            ? `Selected ${selectedNoteCountLabel} will be permanently deleted and cannot be restored. ${formatNoteCount(
                  referencedCandidates.length,
              )} ${referencedCandidates.length === 1 ? 'is' : 'are'} still referenced by other notes, so those links will stay broken. Other notes will not be edited automatically.`
            : `Selected ${selectedNoteCountLabel} will be permanently deleted and cannot be restored.`;

    return (
        <Modal isOpen={candidates.length > 0} onClose={onClose} variant="inspect">
            <Modal.Header title={title} onClose={onClose} />
            <Modal.Body>
                <div className="flex flex-col gap-3">
                    <Modal.Description className="text-meta font-normal text-fg-secondary">
                        {description}
                    </Modal.Description>
                    <div className="overflow-hidden rounded-[16px] border border-border-subtle bg-hover-subtle/40">
                        <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
                            <Text
                                as="p"
                                variant="micro"
                                weight="semibold"
                                tracking="wider"
                                transform="uppercase"
                                tone="tertiary"
                            >
                                Selected notes
                            </Text>
                            <Text as="p" variant="label" tone="tertiary">
                                {selectedNoteCountLabel}
                            </Text>
                        </div>
                        <ul className="flex flex-col">
                            {candidates.map((candidate, index) => (
                                <li
                                    key={candidate.id}
                                    className={index > 0 ? 'border-t border-border-subtle' : undefined}
                                >
                                    <div className="px-4 py-3">
                                        <Text as="p" variant="body" weight="medium" className="break-words">
                                            {candidate.title || 'Untitled note'}
                                        </Text>
                                        {candidate.backReferenceCount > 0 && (
                                            <Text as="p" variant="label" tone="error" className="mt-1">
                                                Referenced by {formatNoteCount(candidate.backReferenceCount)}
                                            </Text>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={onConfirm} isLoading={isDeleting}>
                        {BULK_DELETE_MODAL_COPY.confirmLabel}
                    </Button>
                </ModalActionRow>
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
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
    const [purgeWarningState, setPurgeWarningState] = useState<PurgeWarningState | null>(null);
    const [bulkPurgeCandidates, setBulkPurgeCandidates] = useState<BulkPurgeCandidate[]>([]);
    const [isPreparingBulkDelete, setIsPreparingBulkDelete] = useState(false);

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

    useEffect(() => {
        const availableNoteIds = new Set(data.notes.map((note) => note.id));

        setSelectedNoteIds((current) => current.filter((id) => availableNoteIds.has(id)));
        setBulkPurgeCandidates((current) => current.filter((candidate) => availableNoteIds.has(candidate.id)));

        if (selectedContentNoteId && !availableNoteIds.has(selectedContentNoteId)) {
            setSelectedContentNoteId(null);
        }
    }, [data.notes, selectedContentNoteId]);

    const invalidateTrashQueries = () =>
        queryClient.invalidateQueries({
            queryKey: queryKeys.notes.trashAll(),
            exact: false,
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

            setSelectedNoteIds((current) => current.filter((id) => id !== response.restoreTrashedNote.id));
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
        onSuccess: async (response, id) => {
            if (response.type === 'error') {
                throw response;
            }

            await invalidateTrashQueries();
            setSelectedNoteIds((current) => current.filter((selectedId) => selectedId !== id));
            toast('The note has been permanently deleted.');
        },
        onError: () => {
            toast('Failed to permanently delete the note.');
        },
    });

    const bulkPurgeMutation = useMutation({
        mutationFn: async (candidates: BulkPurgeCandidate[]) => {
            const results = await Promise.allSettled(
                candidates.map(async (candidate) => ({
                    id: candidate.id,
                    response: await purgeTrashedNote(candidate.id),
                })),
            );

            return { candidates, results };
        },
        onSuccess: async ({ candidates, results }) => {
            const successfulIds = results.flatMap((result) => {
                if (result.status !== 'fulfilled' || result.value.response.type === 'error') {
                    return [];
                }

                return [result.value.id];
            });
            const successCount = successfulIds.length;
            const totalCount = candidates.length;

            if (successCount > 0) {
                await invalidateTrashQueries();
            }

            setSelectedNoteIds((current) => current.filter((id) => !successfulIds.includes(id)));

            if (successCount === totalCount) {
                toast(`${formatNoteCount(successCount)} permanently deleted.`);
                return;
            }

            if (successCount === 0) {
                toast('Failed to permanently delete the selected notes.');
                return;
            }

            toast(`${successCount} of ${totalCount} selected notes were permanently deleted.`);
        },
        onError: () => {
            toast('Failed to permanently delete the selected notes.');
        },
    });

    const selectedNotes = data.notes.filter((note) => selectedNoteIds.includes(note.id));
    const allSelectedOnPage = data.notes.length > 0 && selectedNoteIds.length === data.notes.length;
    const selectedContentNote = data.notes.find((note) => note.id === selectedContentNoteId) ?? null;
    const heading = data.totalCount > 0 ? `Trash (${data.totalCount})` : undefined;

    const toggleNoteSelection = (id: string, checked: boolean) => {
        setSelectedNoteIds((current) => {
            if (checked) {
                return current.includes(id) ? current : [...current, id];
            }

            return current.filter((noteId) => noteId !== id);
        });
    };

    const toggleAllNotesOnPage = (checked: boolean) => {
        setSelectedNoteIds(checked ? data.notes.map((note) => note.id) : []);
    };

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

    const handleBulkDeletePreview = async () => {
        if (selectedNotes.length === 0) {
            return;
        }

        setIsPreparingBulkDelete(true);

        try {
            const backReferenceResponses = await Promise.all(
                selectedNotes.map(async (note) => ({
                    id: note.id,
                    title: note.title,
                    response: await fetchBackReferences(note.id),
                })),
            );
            const failedResponse = backReferenceResponses.find(({ response }) => response.type === 'error');

            if (failedResponse) {
                toast('Failed to check linked notes before permanently deleting the selected notes.');
                return;
            }

            backReferenceResponses.forEach(({ id, response }) => {
                if (response.type === 'success') {
                    queryClient.setQueryData(queryKeys.notes.backReferences(id), response.backReferences);
                }
            });

            setBulkPurgeCandidates(
                backReferenceResponses.map(({ id, title, response }) => ({
                    id,
                    title,
                    backReferenceCount: response.type === 'success' ? response.backReferences.length : 0,
                })),
            );
        } finally {
            setIsPreparingBulkDelete(false);
        }
    };

    const handleBulkDeleteConfirm = () => {
        if (bulkPurgeCandidates.length === 0) {
            return;
        }

        bulkPurgeMutation.mutate(bulkPurgeCandidates, {
            onSettled: () => {
                setBulkPurgeCandidates([]);
            },
        });
    };

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
                <div className="surface-base flex flex-col gap-3 rounded-[18px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="selectAllTrashNotes"
                            size="sm"
                            aria-label="Select all notes on this page"
                            checked={allSelectedOnPage}
                            onChange={(event) => toggleAllNotesOnPage(event.target.checked)}
                        />
                        <Label htmlFor="selectAllTrashNotes" size="sm" className="cursor-pointer text-fg-secondary">
                            Select all on this page
                        </Label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Text as="span" variant="label" weight="medium" tone="secondary">
                            {selectedNoteIds.length > 0
                                ? `Selected ${formatNoteCount(selectedNoteIds.length)}`
                                : 'No notes selected'}
                        </Text>
                        {selectedNoteIds.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedNoteIds([])}>
                                Clear
                            </Button>
                        )}
                        <Button
                            variant="soft-danger"
                            size="sm"
                            disabled={selectedNoteIds.length === 0}
                            isLoading={isPreparingBulkDelete}
                            onClick={() => void handleBulkDeletePreview()}
                        >
                            Delete selected
                        </Button>
                    </div>
                </div>
                <div className="grid gap-3">
                    {data.notes.map((note) => {
                        const isSelected = selectedNoteIds.includes(note.id);
                        const checkboxId = `trashed-note-select-${note.id}`;

                        return (
                            <SurfaceCard key={note.id} padding="compact">
                                <div className="flex gap-3">
                                    <div className="pt-0.5">
                                        <Checkbox
                                            id={checkboxId}
                                            size="sm"
                                            checked={isSelected}
                                            aria-label={`Select ${note.title || 'Untitled note'}`}
                                            onChange={(event) => toggleNoteSelection(note.id, event.target.checked)}
                                        />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-start gap-1.5">
                                                <Label
                                                    htmlFor={checkboxId}
                                                    size="sm"
                                                    className="min-w-0 flex-1 cursor-pointer whitespace-normal"
                                                >
                                                    <Text
                                                        as="span"
                                                        variant="body"
                                                        weight="medium"
                                                        className="min-w-0 break-words leading-[1.25] text-fg-default"
                                                    >
                                                        {note.title || 'Untitled note'}
                                                    </Text>
                                                </Label>
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
                                                isLoading={
                                                    restoreMutation.isPending && restoreMutation.variables === note.id
                                                }
                                                onClick={() => restoreMutation.mutate(note.id)}
                                            >
                                                Restore
                                            </Button>
                                            <Button
                                                variant="soft-danger"
                                                size="sm"
                                                isLoading={
                                                    purgeMutation.isPending && purgeMutation.variables === note.id
                                                }
                                                onClick={() => void handlePurge(note.id)}
                                            >
                                                Delete now
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </SurfaceCard>
                        );
                    })}
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
            <TrashedNotesBulkDeleteModal
                candidates={bulkPurgeCandidates}
                isDeleting={bulkPurgeMutation.isPending}
                onClose={() => setBulkPurgeCandidates([])}
                onConfirm={handleBulkDeleteConfirm}
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
