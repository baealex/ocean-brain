import { forwardRef } from 'react';
import classNames from 'classnames';

import { Text } from '../Text';

interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    description?: string;
}

const Empty = forwardRef<HTMLDivElement, EmptyProps>(
    ({ title, description, className = '', ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={classNames(
                    'flex flex-col items-center justify-center text-center',
                    'h-[400px]',
                    'bg-muted/30',
                    'border-2 border-dashed',
                    'border-border-secondary',
                    'rounded-[20px]',
                    'p-8',
                    className
                )}
                {...props}>
                {title && (
                    <Text
                        as="h3"
                        variant="heading"
                        weight="bold"
                        tone="muted"
                        className="mb-2">
                        {title}
                    </Text>
                )}
                {description && (
                    <Text
                        as="p"
                        variant="meta"
                        weight="medium"
                        tone="tertiary"
                        className="max-w-[400px]">
                        {description}
                    </Text>
                )}
            </div>
        );
    }
);

Empty.displayName = 'Empty';

export default Empty;
