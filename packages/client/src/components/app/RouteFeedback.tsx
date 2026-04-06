import { useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';

import { PageLayout, Skeleton } from '~/components/shared';
import { Button } from '~/components/ui';
import { HOME_ROUTE } from '~/modules/url';

interface RoutePendingViewProps {
    title?: string;
    description?: string;
}

interface RouteErrorViewProps {
    error: unknown;
    reset?: () => void;
}

interface QueryErrorViewProps {
    title: string;
    error: unknown;
    description?: string;
    onRetry?: () => void;
    showBackAction?: boolean;
    showHomeAction?: boolean;
}

const DEFAULT_ERROR_MESSAGE = 'An unexpected routing error occurred.';

const isGraphQueryErrorResponse = (
    error: unknown
): error is {
    errors?: Array<{
        code?: string;
        message?: string;
    }>;
} => {
    return typeof error === 'object'
        && error !== null
        && 'errors' in error
        && Array.isArray(error.errors);
};

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }

    if (isGraphQueryErrorResponse(error)) {
        return error.errors?.[0]?.message ?? DEFAULT_ERROR_MESSAGE;
    }

    return DEFAULT_ERROR_MESSAGE;
};

const getErrorCode = (error: unknown) => {
    if (isGraphQueryErrorResponse(error)) {
        return error.errors?.[0]?.code;
    }

    return undefined;
};

export function QueryErrorView({
    title,
    error,
    description,
    onRetry,
    showBackAction = true,
    showHomeAction = true
}: QueryErrorViewProps) {
    const navigate = useNavigate();
    const router = useRouter();
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

    const message = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const handleCopy = async () => {
        try {
            const details = [errorCode, message].filter(Boolean).join(' :: ');
            await navigator.clipboard.writeText(details || DEFAULT_ERROR_MESSAGE);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    };

    return (
        <div className="rounded-[18px] border-2 border-border bg-surface p-6">
            <p className="text-heading font-bold">{title}</p>
            {description && (
                <p className="text-meta mt-2 text-fg-tertiary">{description}</p>
            )}
            <div className="text-body mt-4 rounded-[14px] border border-border-subtle bg-subtle px-3 py-2 text-fg-secondary">
                {message}
                {errorCode && (
                    <span className="ml-2 font-bold text-fg-tertiary">[{errorCode}]</span>
                )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                {onRetry && (
                    <Button size="sm" onClick={onRetry}>
                        Try again
                    </Button>
                )}
                {showBackAction && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.history.back()}>
                        Go back
                    </Button>
                )}
                {showHomeAction && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate({
                            to: HOME_ROUTE,
                            search: {
                                page: 1,
                                sortBy: 'updatedAt',
                                sortOrder: 'desc',
                                pinnedFirst: false
                            }
                        })}>
                        Go home
                    </Button>
                )}
                <Button size="sm" variant="ghost" onClick={handleCopy}>
                    {copyState === 'copied'
                        ? 'Copied details'
                        : copyState === 'failed'
                            ? 'Copy failed'
                            : 'Copy details'}
                </Button>
            </div>
        </div>
    );
}

export function RoutePendingView({
    title = 'Loading page',
    description = 'Preparing route resources.'
}: RoutePendingViewProps) {
    return (
        <PageLayout title={title} description={description} variant="none">
            <div className="flex flex-col gap-4">
                <Skeleton height="56px" />
                <Skeleton height="220px" />
                <Skeleton height="160px" />
            </div>
        </PageLayout>
    );
}

export function RouteErrorView({ error, reset }: RouteErrorViewProps) {
    return (
        <PageLayout title="Something went wrong" variant="none">
            <QueryErrorView
                title="Route failed to render"
                description="Retry the route or navigate somewhere safe."
                error={error}
                onRetry={reset}
            />
        </PageLayout>
    );
}

export function RouteNotFoundView() {
    return (
        <PageLayout title="Not found" variant="none">
            <div className="rounded-[18px] border-2 border-border bg-surface p-6">
                <p className="text-heading font-bold">This page does not exist.</p>
                <p className="text-meta mt-2 text-fg-tertiary">
                    Check the URL or navigate from the sidebar.
                </p>
            </div>
        </PageLayout>
    );
}
