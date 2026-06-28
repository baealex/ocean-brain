import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

import Providers from './Providers';

function QueryClientConsumer() {
    const queryClient = useQueryClient();

    return <div>{queryClient ? 'query-client-ready' : 'query-client-missing'}</div>;
}

describe('<Providers />', () => {
    it('provides the app query client context to children', () => {
        render(
            <Providers>
                <QueryClientConsumer />
            </Providers>,
        );

        expect(screen.getByText('query-client-ready')).toBeInTheDocument();
    });
});
