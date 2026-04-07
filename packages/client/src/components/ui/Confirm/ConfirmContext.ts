import { createContext } from 'react';

export interface ConfirmContextValue {
    confirm: (message: string) => Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);
