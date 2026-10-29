import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { createWorkspace, updateWorkspace } from '~/apis/workspace.api';
import { PageLayout } from '~/components/shared';
import { Button, Input, Label, Text, useConfirm, useToast } from '~/components/ui';
import type { Workspace } from '~/models/workspace.model';
import { queryKeys } from '~/modules/query-key-factory';
import { validateHomeSearch } from '~/modules/route-search';
import { HOME_ROUTE } from '~/modules/url';
import { DEFAULT_WORKSPACE_ID } from '~/modules/workspace-scope';
import { useWorkspace } from '~/store/workspace';

const WorkspaceRow = ({
    workspace,
    onSave,
    busy,
}: {
    workspace: Workspace;
    onSave: (workspace: Workspace, input: { name?: string; archived?: boolean }) => void;
    busy: boolean;
}) => {
    const [name, setName] = useState(workspace.name);
    return (
        <div className="surface-base flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Input
                    aria-label={`Name for ${workspace.name}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                />
                {workspace.id === DEFAULT_WORKSPACE_ID && (
                    <Text variant="meta" tone="secondary">
                        Default for existing connections and quick capture.
                    </Text>
                )}
                {workspace.archivedAt && (
                    <Text variant="meta" tone="secondary">
                        Archived · records and references are preserved.
                    </Text>
                )}
            </div>
            <Button
                variant="subtle"
                disabled={busy || !name.trim() || name.trim() === workspace.name}
                onClick={() => onSave(workspace, { name: name.trim() })}
            >
                Rename
            </Button>
            {workspace.id !== DEFAULT_WORKSPACE_ID && (
                <Button
                    variant="subtle"
                    disabled={busy}
                    onClick={() => onSave(workspace, { archived: !workspace.archivedAt })}
                >
                    {workspace.archivedAt ? 'Unarchive' : 'Archive'}
                </Button>
            )}
        </div>
    );
};

export default function Workspaces() {
    const { workspaces, workspaceId, error } = useWorkspace();
    const [name, setName] = useState('');
    const client = useQueryClient();
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();
    const create = useMutation({
        mutationFn: createWorkspace,
        onSuccess: async (response) => {
            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }
            await client.invalidateQueries({ queryKey: queryKeys.workspaces.all(), exact: false });
            setName('');
            await navigate({
                to: HOME_ROUTE,
                search: { ...validateHomeSearch({}), workspace: response.createWorkspace.id },
            });
        },
        onError: () => toast('Could not create the workspace. Your current notes are unchanged.'),
    });
    const update = useMutation({
        mutationFn: ({ id, input }: { id: string; input: { name?: string; archived?: boolean } }) =>
            updateWorkspace(id, input),
        onSuccess: async (response) => {
            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }
            await client.invalidateQueries({ queryKey: queryKeys.workspaces.all(), exact: false });
            if (response.updateWorkspace.id === workspaceId && response.updateWorkspace.archivedAt) {
                await navigate({
                    to: HOME_ROUTE,
                    search: { ...validateHomeSearch({}), workspace: DEFAULT_WORKSPACE_ID },
                });
            }
        },
        onError: () => toast('Could not update the workspace. Try again.'),
    });
    const save = async (workspace: Workspace, input: { name?: string; archived?: boolean }) => {
        if (
            input.archived &&
            !(await confirm(
                `Archive ${workspace.name}? Notes and links stay available in search. Unarchive it to make changes.`,
            ))
        )
            return;
        update.mutate({ id: workspace.id, input });
    };
    return (
        <PageLayout
            title="Workspaces"
            description="Keep different fields and views for different kinds of records. You can keep using just one workspace."
        >
            <div className="flex flex-col gap-6">
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (name.trim() && !create.isPending) create.mutate(name.trim());
                    }}
                >
                    <Label htmlFor="workspace-name">New workspace</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            id="workspace-name"
                            placeholder="e.g. Diet"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={80}
                        />
                        <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>
                            Create workspace
                        </Button>
                    </div>
                    <Text variant="meta" tone="secondary">
                        Start with a name. Add notes, fields and views whenever you need them.
                    </Text>
                </form>
                {error && (
                    <div role="alert" className="surface-base flex items-center gap-3 p-4">
                        <Text>{error.message}</Text>
                        <Button
                            variant="subtle"
                            onClick={() =>
                                void client.invalidateQueries({ queryKey: queryKeys.workspaces.all(), exact: false })
                            }
                        >
                            Retry
                        </Button>
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    {workspaces.map((workspace) => (
                        <WorkspaceRow
                            key={workspace.id}
                            workspace={workspace}
                            busy={update.isPending}
                            onSave={(workspace, input) => void save(workspace, input)}
                        />
                    ))}
                </div>
            </div>
        </PageLayout>
    );
}
