import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchNoteWorkspaceMovePreview, moveNoteToWorkspace } from '~/apis/workspace.api';
import { Modal, ModalActionRow } from '~/components/shared';
import { Button, Select, SelectItem, Text, useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { invalidateQueriesForNoteChange } from '~/modules/server-event-invalidation';
import { useWorkspace } from '~/store/workspace';
import {
    hasCompleteWorkspaceMappings,
    PropertyWorkspaceMappings,
    workspaceMappings,
} from './PropertyWorkspaceMappings';

export const MoveNoteWorkspaceModal = ({
    noteId,
    sourceWorkspaceId,
    onClose,
}: {
    noteId: string;
    sourceWorkspaceId: string;
    onClose: () => void;
}) => {
    const { workspaces } = useWorkspace();
    const [target, setTarget] = useState('');
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const client = useQueryClient();
    const toast = useToast();
    const preview = useQuery({
        queryKey: queryKeys.workspaces.movePreview(noteId, target),
        queryFn: async () => {
            const response = await fetchNoteWorkspaceMovePreview(noteId, target);
            if (response.type === 'error') throw new Error(response.errors[0].message);
            return response.previewNoteWorkspaceMove;
        },
        enabled: Boolean(target),
    });
    const move = useMutation({
        mutationFn: moveNoteToWorkspace,
        onSuccess: async (response) => {
            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }
            client.setQueryData(queryKeys.notes.detail(noteId), response.moveNoteToWorkspace);
            await invalidateQueriesForNoteChange(client);
            toast(`Moved to ${preview.data?.targetWorkspace.name ?? 'the selected workspace'}.`);
            onClose();
        },
        onError: () => toast('Could not confirm the move. Reload the note to check its current workspace.'),
    });
    const data = preview.data;
    return (
        <Modal
            isOpen
            onClose={() => {
                if (!move.isPending) onClose();
            }}
            variant="form"
        >
            <Modal.Header
                title="Move to workspace"
                onClose={() => {
                    if (!move.isPending) onClose();
                }}
            />
            <Modal.Description>
                The same note and its links will stay intact. Review its fields before moving.
            </Modal.Description>
            <Modal.Body>
                <div className="flex flex-col gap-4">
                    <Select
                        ariaLabel="Destination workspace"
                        placeholder="Choose a workspace"
                        value={target}
                        disabled={move.isPending}
                        onValueChange={(value) => {
                            setTarget(value);
                            setMappings({});
                        }}
                    >
                        {workspaces
                            .filter((workspace) => workspace.id !== sourceWorkspaceId && !workspace.archivedAt)
                            .map((workspace) => (
                                <SelectItem key={workspace.id} value={workspace.id}>
                                    {workspace.name}
                                </SelectItem>
                            ))}
                    </Select>
                    {target && preview.isPending && <Text variant="meta">Checking the destination...</Text>}
                    {preview.error && (
                        <div role="alert" className="flex flex-col gap-2">
                            <Text>{preview.error.message}</Text>
                            <Button variant="subtle" onClick={() => void preview.refetch()}>
                                Retry
                            </Button>
                        </div>
                    )}
                    {data && (
                        <>
                            <PropertyWorkspaceMappings preview={data} values={mappings} onChange={setMappings} />
                            {data.templateViews.length > 0 && (
                                <Text variant="meta" tone="secondary">
                                    This note is a default template in{' '}
                                    {data.templateViews.map((view) => view.title).join(', ')}. Remove those template
                                    connections in the view settings before moving it.
                                </Text>
                            )}
                        </>
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button variant="ghost" disabled={move.isPending} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        disabled={
                            !data ||
                            preview.isFetching ||
                            data.templateViews.length > 0 ||
                            !hasCompleteWorkspaceMappings(data, mappings) ||
                            move.isPending
                        }
                        onClick={() => {
                            if (data)
                                move.mutate({
                                    id: noteId,
                                    targetWorkspaceId: target,
                                    expectedUpdatedAt: data.expectedUpdatedAt,
                                    mappings: workspaceMappings(data, mappings),
                                });
                        }}
                    >
                        Move note
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
};
