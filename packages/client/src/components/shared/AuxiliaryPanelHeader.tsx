import classNames from 'classnames';
import type { ReactNode } from 'react';

import { Text } from '~/components/ui';

interface AuxiliaryPanelHeaderProps {
    icon: ReactNode;
    title: string;
    titleTone?: 'default' | 'current';
    className?: string;
}

export default function AuxiliaryPanelHeader({
    icon,
    title,
    titleTone = 'default',
    className,
}: AuxiliaryPanelHeaderProps) {
    return (
        <div className={classNames('flex items-center gap-2', className)}>
            <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-current">{icon}</div>
            <Text as="span" variant="label" weight="semibold" tone={titleTone}>
                {title}
            </Text>
        </div>
    );
}
