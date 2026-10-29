import { scopeFromSearch, workspaceScope } from '~/modules/workspace-scope';
import { useWorkspace } from '~/store/workspace';

export const useWorkspaceScope = (currentByDefault = false) => {
    const { workspaceId, scopeWorkspace } = useWorkspace();
    return scopeFromSearch(scopeWorkspace, currentByDefault ? workspaceScope(workspaceId) : { kind: 'all' });
};
