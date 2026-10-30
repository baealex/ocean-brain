import { Link } from '@tanstack/react-router';
import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { SETTINGS_PROPERTIES_ROUTE, SETTINGS_TRASH_ROUTE, SETTINGS_WORKSPACE_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

const items = {
    properties: {
        to: SETTINGS_PROPERTIES_ROUTE,
        title: 'Properties',
        description: 'Manage fields used across notes.',
        icon: Icon.Tag,
    },
    trash: {
        to: SETTINGS_TRASH_ROUTE,
        title: 'Trash',
        description: 'Restore or permanently delete notes.',
        icon: Icon.TrashCan,
    },
    settings: {
        to: SETTINGS_WORKSPACE_ROUTE,
        title: 'Workspace settings',
        description: 'Properties and trash for this workspace.',
        icon: Icon.Gear,
    },
} as const;

export const WorkspaceSettingsLink = ({ kind }: { kind: keyof typeof items }) => {
    const { workspaceId, multiple, activeWorkspace } = useWorkspace();
    const item = items[kind];
    return (
        <Link
            to={item.to}
            search={{ ...(kind !== 'settings' ? { page: 1 } : {}), ...(multiple ? { workspace: workspaceId } : {}) }}
            className="focus-ring-soft surface-base group flex items-start justify-between gap-3.5 px-4 py-3.5 text-left text-fg-default outline-none transition-colors hover:bg-hover-subtle"
        >
            <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-border-subtle bg-muted text-fg-secondary transition-colors group-hover:border-border-secondary/70 group-hover:text-fg-default">
                    <item.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex flex-col gap-0.5 pt-0.5">
                    <Text as="div" variant="body" weight="medium">
                        {item.title}
                    </Text>
                    <Text as="div" variant="meta" tone="secondary" truncate={kind === 'settings'}>
                        {kind === 'settings' ? (activeWorkspace?.name ?? item.description) : item.description}
                    </Text>
                </div>
            </div>
            <Icon.ChevronRight
                className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-fg-secondary"
                aria-hidden="true"
            />
        </Link>
    );
};
