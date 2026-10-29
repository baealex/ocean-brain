import { useLocation, useNavigate } from '@tanstack/react-router';
import { Select, SelectItem, Text } from '~/components/ui';
import { useWorkspaceScope } from '~/hooks/useWorkspaceScope';
import {
    validateCalendarSearch,
    validateGraphSearch,
    validateHomeSearch,
    validatePaginationSearch,
    validateReminderSearch,
    validateSearchPageSearch,
    validateTagSearch,
} from '~/modules/route-search';
import {
    CALENDAR_ROUTE,
    GRAPH_ROUTE,
    HOME_ROUTE,
    REMINDERS_ROUTE,
    SEARCH_ROUTE,
    SETTINGS_TRASH_ROUTE,
    TAG_NOTES_ROUTE,
    TAG_ROUTE,
} from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

export const WorkspaceScopeControl = ({ currentByDefault = false }: { currentByDefault?: boolean }) => {
    const { workspaces, multiple, workspaceId } = useWorkspace();
    const scope = useWorkspaceScope(currentByDefault);
    const navigate = useNavigate();
    const location = useLocation();
    const changeScope = (scopeWorkspace: string) => {
        const shared = { workspace: workspaceId, scopeWorkspace };
        const search = { ...location.search, page: 1 };
        switch (location.pathname) {
            case HOME_ROUTE:
                return navigate({ to: HOME_ROUTE, search: { ...validateHomeSearch(search), ...shared } });
            case SEARCH_ROUTE:
                return navigate({ to: SEARCH_ROUTE, search: { ...validateSearchPageSearch(search), ...shared } });
            case GRAPH_ROUTE:
                return navigate({ to: GRAPH_ROUTE, search: { ...validateGraphSearch(search), ...shared } });
            case TAG_ROUTE:
                return navigate({ to: TAG_ROUTE, search: { ...validateTagSearch(search), ...shared } });
            case CALENDAR_ROUTE:
                return navigate({ to: CALENDAR_ROUTE, search: { ...validateCalendarSearch(search), ...shared } });
            case REMINDERS_ROUTE:
                return navigate({ to: REMINDERS_ROUTE, search: { ...validateReminderSearch(search), ...shared } });
            case SETTINGS_TRASH_ROUTE:
                return navigate({
                    to: SETTINGS_TRASH_ROUTE,
                    search: { ...validatePaginationSearch(search), ...shared },
                });
            default:
                if (location.pathname.startsWith('/tag/'))
                    return navigate({
                        to: TAG_NOTES_ROUTE,
                        params: { id: location.pathname.slice('/tag/'.length) },
                        search: { ...validatePaginationSearch(search), ...shared },
                    });
        }
    };
    if (!multiple) return null;
    return (
        <div className="flex items-center gap-2 px-4 pb-2">
            <Text as="span" variant="meta" tone="secondary">
                Show notes from
            </Text>
            <Select
                size="sm"
                ariaLabel="Browse workspace"
                value={scope.kind === 'all' ? 'all' : scope.workspaceId}
                onValueChange={(scopeWorkspace) => void changeScope(scopeWorkspace)}
            >
                <SelectItem value="all">All workspaces</SelectItem>
                {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name}
                        {workspace.archivedAt ? ' (archived)' : ''}
                    </SelectItem>
                ))}
            </Select>
        </div>
    );
};
