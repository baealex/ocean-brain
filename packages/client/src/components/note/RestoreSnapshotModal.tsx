import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { fetchNoteSnapshot, fetchNoteSnapshotDiff, fetchNoteSnapshots, restoreNoteSnapshot } from '~/apis/note.api';
import { Button, Modal, ModalActionRow, SurfaceCard } from '~/components/shared';
import { Text, useToast } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';

interface RestoreSnapshotModalProps {
    isOpen: boolean;
    noteId: string;
    onClose: () => void;
    restoreSnapshot?: (id: string) => Promise<Awaited<ReturnType<typeof restoreNoteSnapshot>> | undefined>;
    onRestored?: (note: Pick<Note, 'id' | 'updatedAt'>) => void;
}

const formatSnapshotLabel = (label?: string, entrypoint?: string) => {
    if (label) {
        return label;
    }

    if (entrypoint === 'mobile') {
        return 'Mobile browser';
    }

    if (entrypoint === 'mcp') {
        return 'MCP';
    }

    return 'Web browser';
};

export default function RestoreSnapshotModal({
    isOpen,
    noteId,
    onClose,
    restoreSnapshot = restoreNoteSnapshot,
    onRestored,
}: RestoreSnapshotModalProps) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
    const [selectedSnapshotView, setSelectedSnapshotView] = useState<'diff' | 'content'>('diff');
    const backButtonRef = useRef<HTMLButtonElement>(null);

    const snapshotQuery = useQuery({
        queryKey: queryKeys.notes.snapshots(noteId),
        queryFn: async () => {
            const response = await fetchNoteSnapshots(noteId);
            if (response.type === 'error') {
                throw response;
            }
            return response.noteSnapshots;
        },
        enabled: isOpen,
    });

    const restoreMutation = useMutation({
        mutationFn: restoreSnapshot,
        onSuccess: async (response) => {
            if (!response) {
                return;
            }

            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.detail(noteId),
                    exact: true,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.listAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.tagListAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.tagNameListAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.pinned(),
                    exact: true,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.backReferencesAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.graph(),
                    exact: true,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.snapshots(noteId),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.views.sectionNotesAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.tags.all(),
                    exact: false,
                }),
            ]);

            toast('Previous version restored.');
            onRestored?.(response.restoreNoteSnapshot);
            setSelectedSnapshotId(null);
            onClose();
        },
    });

    const selectedSnapshot = snapshotQuery.data?.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null;
    const selectedSnapshotDiffQuery = useQuery({
        queryKey: [...queryKeys.notes.snapshotDetail(selectedSnapshotId ?? 'pending'), 'diff'],
        queryFn: async () => {
            if (!selectedSnapshotId) {
                throw new Error('SNAPSHOT_NOT_SELECTED');
            }

            const response = await fetchNoteSnapshotDiff(selectedSnapshotId, 'current');
            if (response.type === 'error') {
                throw response;
            }

            if (!response.noteSnapshotDiff) {
                throw new Error('SNAPSHOT_DIFF_NOT_FOUND');
            }

            return response.noteSnapshotDiff;
        },
        enabled: Boolean(selectedSnapshotId) && selectedSnapshotView === 'diff',
    });
    const selectedSnapshotQuery = useQuery({
        queryKey: queryKeys.notes.snapshotDetail(selectedSnapshotId ?? 'pending'),
        queryFn: async () => {
            if (!selectedSnapshotId) {
                throw new Error('SNAPSHOT_NOT_SELECTED');
            }

            const response = await fetchNoteSnapshot(selectedSnapshotId);
            if (response.type === 'error') {
                throw response;
            }

            if (!response.noteSnapshot) {
                throw new Error('SNAPSHOT_NOT_FOUND');
            }

            return response.noteSnapshot;
        },
        enabled: Boolean(selectedSnapshotId) && selectedSnapshotView === 'content',
    });
    const selectedSnapshotContent = selectedSnapshotQuery.data?.contentAsMarkdown.trim() ?? '';

    useEffect(() => {
        if (selectedSnapshotId) {
            backButtonRef.current?.focus();
        }
    }, [selectedSnapshotId]);

    const openSnapshot = (id: string, view: 'diff' | 'content') => {
        setSelectedSnapshotView(view);
        setSelectedSnapshotId(id);
    };

    const handleClose = () => {
        setSelectedSnapshotId(null);
        setSelectedSnapshotView('diff');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} variant="inspect">
            <Modal.Header
                title={
                    selectedSnapshot
                        ? selectedSnapshotView === 'diff'
                            ? 'Snapshot Diff'
                            : 'Snapshot Content'
                        : 'Restore Previous Version'
                }
                onClose={handleClose}
            />
            <Modal.Description className="sr-only">
                {selectedSnapshot
                    ? selectedSnapshotView === 'diff'
                        ? 'Review the markdown diff between this snapshot and the current note.'
                        : 'Read this snapshot content before restoring it.'
                    : 'Choose a previous snapshot to restore.'}
            </Modal.Description>
            <Modal.Body>
                {selectedSnapshot ? (
                    <div className="flex flex-col gap-3">
                        <div className="min-w-0">
                            <Text as="p" variant="body" weight="semibold" truncate>
                                {selectedSnapshot.title}
                            </Text>
                            <Text as="p" variant="label" tone="tertiary">
                                Before{' '}
                                {formatSnapshotLabel(selectedSnapshot.meta.label, selectedSnapshot.meta.entrypoint)}{' '}
                                edit - {dayjs(selectedSnapshot.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                            </Text>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={selectedSnapshotView === 'diff' ? 'primary' : 'subtle'}
                                size="sm"
                                onClick={() => setSelectedSnapshotView('diff')}
                            >
                                Show diff
                            </Button>
                            <Button
                                variant={selectedSnapshotView === 'content' ? 'primary' : 'subtle'}
                                size="sm"
                                onClick={() => setSelectedSnapshotView('content')}
                            >
                                View content
                            </Button>
                        </div>
                        {selectedSnapshotView === 'diff' ? (
                            selectedSnapshotDiffQuery.isLoading ? (
                                <Text
                                    as="p"
                                    variant="meta"
                                    tone="secondary"
                                    className="rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3"
                                >
                                    Loading snapshot diff...
                                </Text>
                            ) : selectedSnapshotDiffQuery.isError ? (
                                <Text
                                    as="p"
                                    variant="meta"
                                    tone="secondary"
                                    className="rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3"
                                >
                                    Snapshot diff could not be loaded.
                                </Text>
                            ) : selectedSnapshotDiffQuery.data ? (
                                <div className="flex flex-col gap-2">
                                    <Text as="p" variant="meta" tone="secondary">
                                        Changes from this snapshot to the current note. Red lines were in the snapshot;
                                        green lines are in the current note.
                                    </Text>
                                    <pre className="max-h-[60vh] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-0 py-3 text-xs leading-5 text-fg-secondary">
                                        {selectedSnapshotDiffQuery.data.diff.markdown.split('\n').map((line, index) => {
                                            const tone =
                                                line.startsWith('+') && !line.startsWith('+++')
                                                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'
                                                    : line.startsWith('-') && !line.startsWith('---')
                                                      ? 'bg-rose-500/12 text-rose-700 dark:text-rose-200'
                                                      : line.startsWith('@@')
                                                        ? 'bg-sky-500/12 text-sky-700 dark:text-sky-200'
                                                        : 'text-fg-secondary';

                                            return (
                                                <span
                                                    key={`${index}-${line}`}
                                                    className={`block min-w-full whitespace-pre-wrap break-words px-4 ${tone}`}
                                                >
                                                    {line || ' '}
                                                </span>
                                            );
                                        })}
                                    </pre>
                                </div>
                            ) : null
                        ) : selectedSnapshotQuery.isLoading ? (
                            <Text
                                as="p"
                                variant="meta"
                                tone="secondary"
                                className="rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3"
                            >
                                Loading snapshot content...
                            </Text>
                        ) : selectedSnapshotQuery.isError ? (
                            <Text
                                as="p"
                                variant="meta"
                                tone="secondary"
                                className="rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3"
                            >
                                Snapshot content could not be loaded.
                            </Text>
                        ) : selectedSnapshotContent ? (
                            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3 text-sm leading-6 text-fg-secondary">
                                {selectedSnapshotContent}
                            </pre>
                        ) : (
                            <Text
                                as="p"
                                variant="meta"
                                tone="secondary"
                                className="rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3"
                            >
                                No readable content was found for this snapshot.
                            </Text>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <Text as="p" variant="meta" tone="secondary">
                            Choose a previous snapshot to restore this note back to that state.
                        </Text>
                        {snapshotQuery.isLoading && (
                            <Text as="div" variant="meta" tone="secondary">
                                Loading previous versions...
                            </Text>
                        )}
                        {!snapshotQuery.isLoading && snapshotQuery.data?.length === 0 && (
                            <Text
                                as="div"
                                variant="meta"
                                tone="secondary"
                                className="rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-4 py-3"
                            >
                                A recovery snapshot appears before the first edit in a session. Up to 10 recent
                                snapshots are kept for 7 days, and identical versions are skipped.
                            </Text>
                        )}
                        {!snapshotQuery.isLoading && snapshotQuery.data && snapshotQuery.data.length > 0 && (
                            <div className="flex flex-col gap-2">
                                {snapshotQuery.data.map((snapshot) => (
                                    <SurfaceCard key={snapshot.id} padding="compact">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <Text as="p" variant="body" weight="semibold">
                                                        Before{' '}
                                                        {formatSnapshotLabel(
                                                            snapshot.meta.label,
                                                            snapshot.meta.entrypoint,
                                                        )}{' '}
                                                        edit
                                                    </Text>
                                                    <Text as="p" variant="meta" truncate tone="secondary">
                                                        {snapshot.title}
                                                    </Text>
                                                    <Text as="p" variant="label" tone="tertiary">
                                                        {dayjs(snapshot.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                                                    </Text>
                                                </div>
                                                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                                    <Button
                                                        variant="subtle"
                                                        size="sm"
                                                        onClick={() => openSnapshot(snapshot.id, 'diff')}
                                                    >
                                                        Compare
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        isLoading={restoreMutation.isPending}
                                                        onClick={() => restoreMutation.mutate(snapshot.id)}
                                                    >
                                                        Restore
                                                    </Button>
                                                </div>
                                            </div>
                                            {snapshot.contentPreview && (
                                                <div className="rounded-[14px] border border-border-subtle bg-hover-subtle/50 px-3 py-2">
                                                    <Text
                                                        as="p"
                                                        variant="meta"
                                                        tone="secondary"
                                                        className="line-clamp-4 whitespace-pre-wrap break-words"
                                                    >
                                                        {snapshot.contentPreview}
                                                    </Text>
                                                </div>
                                            )}
                                        </div>
                                    </SurfaceCard>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal.Body>
            {selectedSnapshot && (
                <Modal.Footer>
                    <ModalActionRow>
                        <Button
                            ref={backButtonRef}
                            variant="subtle"
                            onClick={() => {
                                setSelectedSnapshotId(null);
                                setSelectedSnapshotView('diff');
                            }}
                        >
                            Back
                        </Button>
                        <Button
                            isLoading={restoreMutation.isPending}
                            onClick={() => restoreMutation.mutate(selectedSnapshot.id)}
                        >
                            Restore this version
                        </Button>
                    </ModalActionRow>
                </Modal.Footer>
            )}
        </Modal>
    );
}
