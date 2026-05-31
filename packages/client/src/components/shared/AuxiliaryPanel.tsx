import classNames from 'classnames';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import AuxiliaryPanelHeader from './AuxiliaryPanelHeader';

interface AuxiliaryPanelProps {
    title: string;
    icon: ReactNode;
    action?: ReactNode;
    titleButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
    ariaLabel?: string;
    className?: string;
    children?: ReactNode;
}

export default function AuxiliaryPanel({
    title,
    icon,
    action,
    titleButtonProps,
    ariaLabel,
    className,
    children,
}: AuxiliaryPanelProps) {
    const hasBody = children !== undefined && children !== null && children !== false;
    const hasAction = action !== undefined && action !== null && action !== false;
    const header = <AuxiliaryPanelHeader icon={icon} title={title} className="text-fg-tertiary" />;

    return (
        <section className={classNames('surface-base mb-5 p-4', className)} aria-label={ariaLabel ?? title}>
            <div className={classNames('relative', hasAction && 'pr-44 sm:pr-48', hasBody && 'mb-3')}>
                {titleButtonProps ? (
                    <button
                        {...titleButtonProps}
                        type="button"
                        className={classNames(
                            'focus-ring-soft -m-1 flex items-center gap-2 rounded-[10px] p-1 text-fg-tertiary transition-colors hover:bg-hover-subtle hover:text-fg-default',
                            titleButtonProps.className,
                        )}
                    >
                        {header}
                    </button>
                ) : (
                    header
                )}
                {hasAction && (
                    <div className="absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-2">{action}</div>
                )}
            </div>
            {children}
        </section>
    );
}
