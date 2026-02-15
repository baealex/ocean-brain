import { forwardRef } from 'react';
import * as Icon from '~/components/icon';

export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
    size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
};

const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    (
        {
            className,
            size = 'md',
            checked,
            disabled,
            ...props
        },
        ref
    ) => {
        return (
            <label
                className={[
                    'relative inline-flex items-center justify-center cursor-pointer',
                    disabled && 'cursor-not-allowed opacity-50',
                    className
                ]
                    .filter(Boolean)
                    .join(' ')}>
                <input
                    ref={ref}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    className="sr-only peer"
                    {...props}
                />
                <span
                    className={[
                        sizeClasses[size],
                        'flex items-center justify-center',
                        'border-2 border-border',
                        'rounded-[4px_2px_5px_2px/2px_4px_2px_4px]',
                        'bg-surface',
                        'transition-all duration-200',
                        'peer-checked:bg-accent-primary',
                        'peer-focus:shadow-sketchy'
                    ].join(' ')}>
                    {checked && (
                        <Icon.Check
                            width={iconSizes[size]}
                            height={iconSizes[size]}
                            className="text-fg-default"
                            weight="bold"
                        />
                    )}
                </span>
            </label>
        );
    }
);

Checkbox.displayName = 'Checkbox';
