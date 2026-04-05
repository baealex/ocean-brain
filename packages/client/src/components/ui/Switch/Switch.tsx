import { forwardRef } from 'react';

export interface SwitchProps
    extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
    (
        {
            checked,
            onCheckedChange,
            onClick,
            className,
            disabled,
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                className={[
                    'focus-ring-soft relative inline-flex h-7 w-12 items-center rounded-full border p-1 transition-colors duration-200 outline-none',
                    checked
                        ? 'border-transparent bg-cta hover:bg-cta-hover active:bg-cta-hover'
                        : 'border-border bg-subtle hover:bg-hover active:bg-active',
                    disabled ? 'cursor-not-allowed opacity-80' : '',
                    className
                ].filter(Boolean).join(' ')}
                onClick={(event) => {
                    onClick?.(event);
                    if (event.defaultPrevented || disabled) {
                        return;
                    }

                    onCheckedChange?.(!checked);
                }}
                {...props}>
                <span
                    aria-hidden="true"
                    className={[
                        'pointer-events-none inline-block h-5 w-5 rounded-full shadow-sm transition-transform duration-200',
                        checked ? 'translate-x-5 bg-white' : 'translate-x-0 bg-fg-secondary'
                    ].join(' ')}
                />
            </button>
        );
    }
);

Switch.displayName = 'Switch';
