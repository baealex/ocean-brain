import { QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';

import { ConfirmProvider } from '~/components/ui/Confirm';
import { ToastProvider } from '~/components/ui/Toast';

import queryClient from './configs/query-client';
import ServerEventBridge from './ServerEventBridge';

interface ProvidersProps {
    children?: React.ReactNode;
}

const Providers = ({ children }: ProvidersProps) => {
    return (
        <QueryClientProvider client={queryClient}>
            <ConfirmProvider>
                <ToastProvider>
                    <ServerEventBridge />
                    {children}
                </ToastProvider>
            </ConfirmProvider>
        </QueryClientProvider>
    );
};

export default Providers;
