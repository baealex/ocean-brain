import classNames from 'classnames';
import type { ReactNode } from 'react';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';

interface SelectionOptionCardProps {
    title: string;
    description: string;
    selected?: boolean;
    onClick: () => void;
    children?: ReactNode;
}

export default function SelectionOptionCard({
    title,
    description,
    selected = false,
    onClick,
    children,
}: SelectionOptionCardProps) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            className={classNames(
                'focus-ring-soft flex w-full items-start gap-3 rounded-[14px] border p-3 text-left transition-colors sm:p-4',
                selected
                    ? 'border-border-focus bg-accent-soft-primary'
                    : 'border-border-subtle bg-transparent hover:border-border-secondary hover:bg-hover-subtle',
            )}
            onClick={onClick}
        >
            <span
                aria-hidden="true"
                className={classNames(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    selected ? 'border-cta bg-cta text-fg-on-filled' : 'border-border-control bg-surface',
                )}
            >
                {selected && <Icon.Check width={12} height={12} weight="bold" />}
            </span>
            <div className="min-w-0 flex-1">
                <Text as="div" variant="body" weight="semibold">
                    {title}
                </Text>
                <Text as="div" variant="meta" weight="medium" tone="secondary" className="mt-1">
                    {description}
                </Text>
            </div>
            {children ? <div className="shrink-0">{children}</div> : null}
        </button>
    );
}
