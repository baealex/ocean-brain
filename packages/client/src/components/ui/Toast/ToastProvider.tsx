import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from 'react';

interface Toast {
    id: number;
    message: string;
}

interface ToastContextValue {
    toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    const toast = useCallback((message: string) => {
        const id = nextId++;
        setToasts((prev) => [...prev, {
            id,
            message
        }]);

        const timer = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            timersRef.current.delete(id);
        }, 3000);

        timersRef.current.set(id, timer);
    }, []);

    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            {toasts.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1200] flex flex-col gap-2 items-center">
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            className="px-5 py-3 bg-surface border-2 border-border rounded-[12px_4px_13px_3px/4px_10px_4px_12px] shadow-sketchy text-sm font-bold text-fg-default animate-slide-in-from-bottom whitespace-nowrap">
                            {t.message}
                        </div>
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context.toast;
}
