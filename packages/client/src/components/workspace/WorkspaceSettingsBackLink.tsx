import { Link } from '@tanstack/react-router';
import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';
import { SETTINGS_WORKSPACE_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

export const WorkspaceSettingsBackLink = () => {
    const { workspaceId, multiple, activeWorkspace } = useWorkspace();
    if (!multiple) return null;
    return (
        <Button asChild variant="subtle" size="sm" className="max-w-full">
            <Link to={SETTINGS_WORKSPACE_ROUTE} search={{ workspace: workspaceId }}>
                <Icon.ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                    Workspace settings{activeWorkspace ? ` · ${activeWorkspace.name}` : ''}
                </span>
            </Link>
        </Button>
    );
};
