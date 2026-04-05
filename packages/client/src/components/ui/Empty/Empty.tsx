import { forwardRef } from 'react';

interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    description?: string;
}

const Empty = forwardRef<HTMLDivElement, EmptyProps>(
    ({ title, description, className = '', ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={[
                    'flex flex-col items-center justify-center text-center',
                    'h-[400px]',
                    'bg-muted/30',
                    'border-2 border-dashed',
                    'border-border-secondary',
                    'rounded-[20px]',
                    'p-8',
                    className
                ].join(' ')}
                {...props}>
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
