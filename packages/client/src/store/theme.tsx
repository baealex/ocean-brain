import { create } from 'zustand';

import { applyThemeClass, getStoredTheme } from './theme-dom';

export type Theme = 'light' | 'dark';

export interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

export const useTheme = create<ThemeState>((set) => ({
    theme: getStoredTheme() ?? 'light',
    setTheme: (theme: Theme) => {
        set({ theme });
    },
    toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' }));
    }
}));

useTheme.subscribe((state) => {
    applyThemeClass(state.theme);
});
