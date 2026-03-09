import {
    Component,
    Suspense,
    type ReactNode
} from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';

import { QueryErrorView } from './RouteFeedback';

interface ResettableErrorBoundaryProps {
    children: ReactNode;
    onReset?: () => void;
    resetKeys?: unknown[];
    fallbackRender: (props: {
        error: unknown;
        resetErrorBoundary: () => void;
    }) => ReactNode;
}

interface ResettableErrorBoundaryState {
    error: unknown | null;
}

interface QueryBoundaryProps {
    children: ReactNode;
    fallback: ReactNode;
    errorTitle: string;
    errorDescription?: string;
    resetKeys?: unknown[];
    renderError?: (props: {
        error: unknown;
        retry: () => void;
    }) => ReactNode;
}

const hasResetKeysChanged = (prevResetKeys: unknown[] = [], resetKeys: unknown[] = []) => {
    return prevResetKeys.length !== resetKeys.length
        || prevResetKeys.some((value, index) => !Object.is(value, resetKeys[index]));
};

class ResettableErrorBoundary extends Component<
    ResettableErrorBoundaryProps,
    ResettableErrorBoundaryState
> {
    state: ResettableErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: unknown) {
        return { error };
    }

    componentDidUpdate(prevProps: Readonly<ResettableErrorBoundaryProps>) {
        if (
            this.state.error !== null
            && hasResetKeysChanged(prevProps.resetKeys, this.props.resetKeys)
        ) {
            this.resetErrorBoundary();
        }
    }

    resetErrorBoundary = () => {
        this.props.onReset?.();
        this.setState({ error: null });
    };

    render() {
        if (this.state.error !== null) {
            return this.props.fallbackRender({
                error: this.state.error,
                resetErrorBoundary: this.resetErrorBoundary
            });
        }

        return this.props.children;
    }
}

export function QueryBoundary({
    children,
    fallback,
    errorTitle,
    errorDescription,
    resetKeys,
    renderError
}: QueryBoundaryProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ResettableErrorBoundary
                    onReset={reset}
                    resetKeys={resetKeys}
                    fallbackRender={({ error, resetErrorBoundary }) => renderError
                        ? renderError({
                            error,
                            retry: resetErrorBoundary
                        })
                        : (
                            <QueryErrorView
                                title={errorTitle}
                                description={errorDescription}
                                error={error}
                                onRetry={resetErrorBoundary}
                            />
                        )}>
                    <Suspense fallback={fallback}>
                        {children}
                    </Suspense>
                </ResettableErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
}
