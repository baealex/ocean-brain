import { act, fireEvent, render, screen } from '@testing-library/react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { createQueryClientWrapper } from '~/test/test-utils';

import { QueryBoundary } from './QueryBoundary';

describe('QueryBoundary', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('renders the suspense fallback until the query resolves', async () => {
        let resolveQuery: ((value: string) => void) | undefined;

        function PendingHarness() {
            const { data } = useSuspenseQuery({
                queryKey: ['pending-boundary'],
                queryFn: () => new Promise<string>((resolve) => {
                    resolveQuery = resolve;
                })
            });

            return <div>{data}</div>;
        }

        const { Wrapper } = createQueryClientWrapper();

        render(
            <QueryBoundary
                fallback={<div>Loading boundary</div>}
                errorTitle="Failed to load pending data">
                <PendingHarness />
            </QueryBoundary>,
            { wrapper: Wrapper }
        );

        expect(screen.getByText('Loading boundary')).toBeInTheDocument();

        await act(async () => {
            resolveQuery?.('Resolved data');
        });

        expect(await screen.findByText('Resolved data')).toBeInTheDocument();
    });

    it('retries a failed suspense query when the boundary resets', async () => {
        let shouldFail = true;

        function RetriableHarness() {
            const { data } = useSuspenseQuery({
                queryKey: ['retry-boundary'],
                queryFn: async () => {
                    if (shouldFail) {
                        throw new Error('Boundary failed');
                    }

                    return 'Recovered data';
                }
            });

            return <div>{data}</div>;
        }

        const { Wrapper } = createQueryClientWrapper();

        render(
            <QueryBoundary
                fallback={<div>Loading boundary</div>}
                errorTitle="Failed to load retriable data"
                renderError={({ error, retry }) => (
                    <div>
                        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
                        <button onClick={retry}>Retry boundary</button>
                    </div>
                )}>
                <RetriableHarness />
            </QueryBoundary>,
            { wrapper: Wrapper }
        );

        expect(await screen.findByText('Boundary failed')).toBeInTheDocument();

        shouldFail = false;
        fireEvent.click(screen.getByRole('button', { name: 'Retry boundary' }));

        expect(await screen.findByText('Recovered data')).toBeInTheDocument();
    });
});
