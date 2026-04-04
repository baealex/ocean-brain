import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchNoteSnapshots, restoreNoteSnapshot } from '~/apis/note.api';
import { Button, Modal } from '~/components/shared';
import { useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';

import type { Note } from '~/models/note.model';

interface RestoreSnapshotModalProps {
    isOpen: boolean;
    noteId: string;
    onClose: () => void;
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
    onRestored
}: RestoreSnapshotModalProps) {
    const toast = useToast();
    const queryClient = useQueryClient();

    const snapshotQuery = useQuery({
        queryKey: queryKeys.notes.snapshots(noteId),
        queryFn: async () => {
            const response = await fetchNoteSnapshots(noteId);
            if (response.type === 'error') {
                throw response;
            }
            return response.noteSnapshots;
        },
        enabled: isOpen
    });

    const restoreMutation = useMutation({
        mutationFn: restoreNoteSnapshot,
        onSuccess: async (response) => {
            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.detail(noteId),
                    exact: true
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.listAll(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.tagListAll(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.pinned(),
                    exact: true
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.backReferences(noteId),
                    exact: true
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.snapshots(noteId),
                    exact: false
                })
            ]);

            toast('Previous version restored.');
            onRestored?.(response.restoreNoteSnapshot);
            onClose();
        }
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <Modal.Header
                title="Restore Previous Version"
                onClose={onClose}
            />
            <Modal.Body>
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-fg-secondary">
                        Choose a previous snapshot to restore this note back to that state.
                    </p>
                    {snapshotQuery.isLoading && (
                        <div className="text-sm text-fg-secondary">Loading previous versions...</div>
                    )}
                    {!snapshotQuery.isLoading && snapshotQuery.data?.length === 0 && (
                        <div className="rounded-[16px] border border-dashed border-border-secondary bg-muted/40 p-4 text-sm text-fg-secondary">
                            A recovery snapshot will appear after the first edit in a session.
                        </div>
                    )}
                    {!snapshotQuery.isLoading && snapshotQuery.data && snapshotQuery.data.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {snapshotQuery.data.map((snapshot) => (
                                <div
                                    key={snapshot.id}
                                    className="surface-base rounded-[16px] border border-border-subtle p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold">
                                                Before {formatSnapshotLabel(snapshot.meta.label, snapshot.meta.entrypoint)} edit
                                            </p>
                                            <p className="truncate text-sm text-fg-secondary">
                                                {snapshot.title}
                                            </p>
                                            <p className="text-xs text-fg-placeholder">
                                                {dayjs(snapshot.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            isLoading={restoreMutation.isPending}
                                            onClick={() => restoreMutation.mutate(snapshot.id)}>
                                            Restore
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal.Body>
        </Modal>
    );
}
