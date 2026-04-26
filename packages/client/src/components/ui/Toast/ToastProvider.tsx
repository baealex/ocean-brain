import { ToastProvider as BaseToastProvider, createToast } from '@baejino/react-ui/toast';

const toast = createToast({ duration: 3000 });

export function ToastProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <BaseToastProvider
                position="bottom-center"
                expand={false}
                visibleToasts={3}
                toastOptions={{
                    duration: 3000,
                    classNames: {
                        toast: 'surface-floating whitespace-nowrap px-5 py-3 text-sm font-medium text-fg-secondary shadow-sm',
                        title: 'text-sm font-medium text-fg-secondary',
                    },
                }}
            />
        </>
    );
}

export function useToast() {
    return toast;
}
