import type { ReactNode } from 'react';

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
    children
}: SelectionOptionCardProps) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            className={`focus-ring-soft flex w-full items-start justify-between gap-3 p-3 text-left transition-colors sm:p-4 ${
                selected
                    ? 'surface-floating bg-elevated'
                    : 'rounded-[14px] border border-border-subtle bg-transparent hover:border-border-secondary hover:bg-hover-subtle'
            }`}
            onClick={onClick}>
            <div className="min-w-0">
                <div className={`text-sm font-semibold sm:text-base ${selected ? 'text-fg-default' : 'text-fg-secondary'}`}>
                    {title}
                </div>
                <div className={`mt-1 text-xs font-medium sm:text-sm ${selected ? 'text-fg-tertiary' : 'text-fg-placeholder'}`}>
                    {description}
                </div>
            </div>
            {children ? <div className="shrink-0">{children}</div> : null}
        </button>
    );
}
