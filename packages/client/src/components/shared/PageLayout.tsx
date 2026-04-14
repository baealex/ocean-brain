import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

import { Text } from '~/components/ui';

interface PageLayoutProps {
    title: string;
    heading?: ReactNode;
    variant?: 'default' | 'subtle' | 'none';
    description?: ReactNode;
    headerRight?: ReactNode;
    children: ReactNode;
}

function renderHeading(title: string, heading?: ReactNode) {
    if (heading == null) {
        return (
            <Text as="h1" variant="heading" weight="bold" tracking="tighter">
                {title}
            </Text>
        );
    }

    if (typeof heading === 'string' || typeof heading === 'number') {
        return (
            <Text as="h1" variant="heading" weight="bold" tracking="tighter">
                {heading}
            </Text>
        );
    }

    return (
        <div role="heading" aria-level={1}>
            {heading}
        </div>
    );
}

function renderDescription(description?: ReactNode) {
    if (description == null) {
        return null;
    }

    if (typeof description === 'string' || typeof description === 'number') {
        return (
            <Text as="p" variant="meta" weight="medium" tone="tertiary" className="mt-1">
                {description}
            </Text>
        );
    }

    return <div className="mt-1">{description}</div>;
}

export default function PageLayout({
    title,
    heading,
    variant = 'default',
    description,
    headerRight,
    children,
}: PageLayoutProps) {
    return (
        <>
            <Helmet>
                <title>{title ? `${title} | Ocean Brain` : 'Ocean Brain'}</title>
            </Helmet>
            {variant === 'default' && (
                <div className="mb-5 border-b border-border-subtle/80 pb-4">
                    <div
                        className={
                            headerRight
                                ? 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
                                : undefined
                        }
                    >
                        <div>
                            {renderHeading(title, heading)}
                            {renderDescription(description)}
                        </div>
                        {headerRight}
                    </div>
                </div>
            )}
            {variant === 'subtle' && (
                <div className="mb-6">
                    <div
                        className={
                            headerRight
                                ? 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
                                : undefined
                        }
                    >
                        <div>
                            {renderHeading(title, heading)}
                            {renderDescription(description)}
                        </div>
                        {headerRight}
                    </div>
                </div>
            )}
            {children}
        </>
    );
}
