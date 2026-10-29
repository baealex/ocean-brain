import { Link, useNavigate } from '@tanstack/react-router';
import { Select, SelectItem, Text } from '~/components/ui';
import { validateHomeSearch } from '~/modules/route-search';
import { HOME_ROUTE, SETTINGS_WORKSPACES_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

export const WorkspaceSwitcher = () => {
    const { workspaceId, workspaces, multiple, activeWorkspace } = useWorkspace();
    const navigate = useNavigate();
    if (!multiple) return null;
    return (
        <div className="flex flex-col gap-2 px-3 pt-3">
            <Select
                value={workspaceId}
                ariaLabel="Workspace"
                onValueChange={(workspace) =>
                    void navigate({ to: HOME_ROUTE, search: { ...validateHomeSearch({}), workspace } })
                }
            >
                {workspaces
                    .filter((workspace) => !workspace.archivedAt || workspace.id === workspaceId)
                    .map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                            {workspace.archivedAt ? ' (archived)' : ''}
                        </SelectItem>
                    ))}
            </Select>
            <Link
                to={SETTINGS_WORKSPACES_ROUTE}
                search={{ workspace: workspaceId }}
                className="text-sm text-fg-secondary underline underline-offset-4"
            >
                Manage workspaces
            </Link>
            {activeWorkspace?.archivedAt && (
                <Text variant="meta" tone="secondary">
                    Archived. Unarchive this workspace in Settings to make changes.
                </Text>
            )}
        </div>
    );
};
