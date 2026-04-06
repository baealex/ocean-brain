import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

import { Text } from '~/components/ui';

interface PageLayoutProps {
    title: string;
    variant?: 'default' | 'subtle' | 'none';
    description?: string;
    headerRight?: ReactNode;
    children: ReactNode;
}

export default function PageLayout({
    title,
    variant = 'default',
    description,
    headerRight,
    children
}: PageLayoutProps) {
    return (
        <>
            <Helmet>
                <title>{title ? `${title} | Ocean Brain` : 'Ocean Brain'}</title>
            </Helmet>
            {variant === 'default' && (
                <div className="mb-5 border-b border-border-subtle/80 pb-4">
                    <div className={headerRight ? 'flex items-center justify-between' : undefined}>
                        <div>
                            <Text as="h1" variant="heading" weight="bold" tracking="tighter">
                                {title}
                            </Text>
                            {description && (
                                <Text
                                    as="p"
                                    variant="meta"
                                    weight="medium"
                                    tone="tertiary"
                                    className="mt-1">
                                    {description}
                                </Text>
                            )}
                        </div>
                        {headerRight}
                    </div>
                </div>
            )}
            {variant === 'subtle' && (
                <div className="mb-6">
                    <div className={headerRight ? 'flex items-center justify-between' : undefined}>
                        <div>
                            <Text as="h1" variant="heading" weight="bold" tracking="tighter">
                                {title}
                            </Text>
                            {description && (
                                <Text
                                    as="p"
                                    variant="meta"
                                    weight="medium"
                                    tone="tertiary"
                                    className="mt-1">
                                    {description}
                                </Text>
                            )}
                        </div>
                        {headerRight}
                    </div>
                </div>
            )}
            {children}
        </>
    );
}
