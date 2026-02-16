import { forwardRef } from 'react';

interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: React.ReactNode;
    title?: string;
    description?: string;
}

const Empty = forwardRef<HTMLDivElement, EmptyProps>(
    ({
        icon, title, description, className = '', ...props
    }, ref) => {
        return (
            <div
                ref={ref}
                className={[
                    'flex flex-col items-center justify-center text-center',
                    'h-[400px]',
                    'bg-muted/30',
                    'border-2 border-dashed',
                    'border-border-secondary',
                    'rounded-[24px_8px_25px_7px/8px_20px_8px_22px]',
                    'p-8',
                    className
                ].join(' ')}
                {...props}>
                {icon && (
                    <div className="mb-4 text-6xl opacity-80">{icon}</div>
                )}
                {title && (
                    <h3 className="text-xl font-bold mb-2 text-fg-muted">
                        {title}
                    </h3>
                )}
                {description && (
                    <p className="text-fg-tertiary max-w-[400px] font-medium">
                        {description}
                    </p>
                )}
            </div>
        );
    }
);

Empty.displayName = 'Empty';

export default Empty;
