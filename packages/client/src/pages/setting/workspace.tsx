import { PageLayout } from '~/components/shared';
import PageBackLink from '~/components/shared/PageBackLink';
import { Text } from '~/components/ui';
import { WorkspaceSettingsLink } from '~/components/workspace/WorkspaceSettingsLink';
import { SETTINGS_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

export default function WorkspaceSettings() {
    const { workspaceId, activeWorkspace, multiple } = useWorkspace();
    return (
        <PageLayout
            title={multiple ? 'Workspace settings' : 'Note settings'}
            description={
                activeWorkspace && (
                    <Text as="p" variant="meta" tone="tertiary" weight="medium" truncate>
                        {activeWorkspace.name}
                    </Text>
                )
            }
            backLink={
                <PageBackLink to={SETTINGS_ROUTE} search={multiple ? { workspace: workspaceId } : {}}>
                    Settings
                </PageBackLink>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <WorkspaceSettingsLink kind="properties" />
                <WorkspaceSettingsLink kind="trash" />
            </div>
        </PageLayout>
    );
}
