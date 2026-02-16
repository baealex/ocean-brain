import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

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
                <div className="mb-4 pb-3 border-b-2 border-border">
                    <div className={headerRight ? 'flex items-center justify-between' : undefined}>
                        <div>
                            <h1 className="text-lg font-bold">{title}</h1>
                            {description && (
                                <p className="text-sm text-fg-tertiary font-medium mt-1">{description}</p>
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
                            <h1 className="text-lg font-bold">{title}</h1>
                            {description && (
                                <p className="text-sm text-fg-tertiary font-medium mt-1">{description}</p>
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
