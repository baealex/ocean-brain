import React from 'react';
import { QueryClientProvider } from 'react-query';

import queryClient from './configs/query-client';

interface ProvidersProps {
    children?: React.ReactNode;
}

const Providers = ({ children }: ProvidersProps) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

export default Providers;
