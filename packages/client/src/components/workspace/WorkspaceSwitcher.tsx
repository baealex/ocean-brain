import { Link, useNavigate } from '@tanstack/react-router';
import * as Icon from '~/components/icon';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Text,
} from '~/components/ui';
import { validateHomeSearch } from '~/modules/route-search';
import { HOME_ROUTE, SETTINGS_WORKSPACE_ROUTE, SETTINGS_WORKSPACES_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

export const WorkspaceSwitcher = () => {
    const { workspaceId, workspaces, multiple, activeWorkspace } = useWorkspace();
    const navigate = useNavigate();
    if (!multiple) return null;
    return (
        <div className="flex flex-col gap-2 px-3 pt-3">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="subtle" aria-label="Workspace" className="w-full px-3">
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <Icon.Grid className="size-4 shrink-0 text-fg-secondary" aria-hidden="true" />
                            <span className="truncate">{activeWorkspace?.name ?? 'Choose a workspace'}</span>
                        </span>
                        <Icon.ChevronDown className="size-3.5 shrink-0 text-fg-tertiary" aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                >
                    <DropdownMenuRadioGroup
                        aria-label="Workspaces"
                        value={workspaceId}
                        onValueChange={(workspace) =>
                            void navigate({ to: HOME_ROUTE, search: { ...validateHomeSearch({}), workspace } })
                        }
                    >
                        {workspaces
                            .filter((workspace) => !workspace.archivedAt || workspace.id === workspaceId)
                            .map((workspace) => (
                                <DropdownMenuRadioItem
                                    key={workspace.id}
                                    value={workspace.id}
                                    aria-label={`${workspace.name}${workspace.archivedAt ? ' (archived)' : ''}`}
                                >
                                    <span className="truncate">
                                        {workspace.name}
                                        {workspace.archivedAt ? ' (archived)' : ''}
                                    </span>
                                </DropdownMenuRadioItem>
                            ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link to={SETTINGS_WORKSPACE_ROUTE} search={{ workspace: workspaceId }} className="gap-2">
                            <Icon.Gear className="size-4 shrink-0" aria-hidden="true" />
                            Workspace settings
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link to={SETTINGS_WORKSPACES_ROUTE} search={{ workspace: workspaceId }} className="gap-2">
                            <Icon.Grid className="size-4 shrink-0" aria-hidden="true" />
                            Manage workspaces
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {activeWorkspace?.archivedAt && (
                <Text variant="meta" tone="secondary">
                    Archived · read only
                </Text>
            )}
        </div>
    );
};
