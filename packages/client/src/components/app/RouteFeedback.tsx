import { PageLayout, Skeleton } from '~/components/shared';

interface RoutePendingViewProps {
    title?: string;
    description?: string;
}

interface RouteErrorViewProps {
    error: unknown;
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

export function RouteErrorView({ error }: RouteErrorViewProps) {
    const message = error instanceof Error
        ? error.message
        : 'An unexpected routing error occurred.';

    return (
        <PageLayout title="Something went wrong" variant="none">
            <div className="rounded-sketchy-lg border-2 border-border bg-surface p-6 shadow-sketchy">
                <p className="text-lg font-bold">Route failed to render</p>
                <p className="mt-2 text-sm text-fg-tertiary">{message}</p>
            </div>
        </PageLayout>
    );
}

export function RouteNotFoundView() {
    return (
        <PageLayout title="Not found" variant="none">
            <div className="rounded-sketchy-lg border-2 border-border bg-surface p-6 shadow-sketchy">
                <p className="text-lg font-bold">This page does not exist.</p>
                <p className="mt-2 text-sm text-fg-tertiary">
                    Check the URL or navigate from the sidebar.
                </p>
            </div>
        </PageLayout>
    );
}
