import type { ReactNode } from 'react';

import { Text } from '~/components/ui';

interface SidebarSectionHeaderProps {
    title: string;
    icon?: ReactNode;
    detail?: ReactNode;
}

const rootClassName = 'mb-2.5 flex items-center justify-between gap-3 px-1';
const leadingClassName = 'flex min-w-0 items-center gap-2';
const iconClassName = 'inline-flex h-4 w-4 shrink-0 items-center justify-center text-fg-tertiary';

const SidebarSectionHeader = ({ title, icon, detail }: SidebarSectionHeaderProps) => (
    <div className={rootClassName}>
        <div className={leadingClassName}>
            {icon ? <span className={iconClassName}>{icon}</span> : null}
            <Text variant="label" weight="medium" tone="tertiary">
                {title}
            </Text>
        </div>
        {detail ? (
            <Text as="div" variant="meta" weight="medium" tone="tertiary">
                {detail}
            </Text>
        ) : null}
    </div>
);

export default SidebarSectionHeader;
