import type { ReactNode } from 'react';
import classNames from 'classnames';

import { Text } from '~/components/ui';

interface AuxiliaryPanelHeaderProps {
    icon: ReactNode;
    title: string;
    className?: string;
}

export default function AuxiliaryPanelHeader({
    icon,
    title,
    className
}: AuxiliaryPanelHeaderProps) {
    return (
        <div className={classNames('flex items-center gap-2', className)}>
            <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-current">
                {icon}
            </div>
            <Text
                as="span"
                variant="label"
                weight="semibold"
                className="text-current">
                {title}
            </Text>
        </div>
    );
}
