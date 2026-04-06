import type { ReactNode } from 'react';

import { Text } from '~/components/ui';

interface SidebarSectionHeaderProps {
    title: string;
    icon?: ReactNode;
}

const SidebarSectionHeader = ({ title, icon }: SidebarSectionHeaderProps) => (
    <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
            <Text
                variant="label"
                weight="medium"
                tracking="wider"
                transform="uppercase"
                tone="tertiary">
                {title}
            </Text>
            <span className="h-px flex-1 bg-border-subtle" />
        </div>
        {icon ? <div className="shrink-0 text-fg-tertiary">{icon}</div> : null}
    </div>
);

export default SidebarSectionHeader;
