import { Text } from '~/components/ui';
import { useWorkspace } from '~/store/workspace';

export const WorkspaceBadge = ({ workspaceId }: { workspaceId?: string }) => {
    const { workspaces, multiple } = useWorkspace();
    if (!multiple || !workspaceId) return null;
    const workspace = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!workspace) return null;
    return (
        <Text
            as="span"
            variant="label"
            tone="tertiary"
            className="inline-flex rounded-full border border-border-subtle px-2 py-0.5"
        >
            {workspace.name}
            {workspace.archivedAt ? ' · archived' : ''}
        </Text>
    );
};
