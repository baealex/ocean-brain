import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { ConfirmProvider } from '~/components/ui/Confirm';
import { ToastProvider } from '~/components/ui/Toast';

import queryClient from './configs/query-client';

interface ProvidersProps {
    children?: React.ReactNode;
}

const Providers = ({ children }: ProvidersProps) => {
    return (
        <QueryClientProvider client={queryClient}>
            <ConfirmProvider>
                <ToastProvider>
                    {children}
                </ToastProvider>
            </ConfirmProvider>
        </QueryClientProvider>
    );
};

export default Providers;
