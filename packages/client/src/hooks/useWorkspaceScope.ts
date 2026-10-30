import { workspaceScope } from '~/modules/workspace-scope';
import { useWorkspace } from '~/store/workspace';

export const useWorkspaceScope = () => workspaceScope(useWorkspace().workspaceId);
