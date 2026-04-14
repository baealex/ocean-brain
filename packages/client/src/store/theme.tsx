import { create } from 'zustand';

import { applyThemeClass, getStoredTheme } from './theme-dom';

export type Theme = 'light' | 'dark';

export interface ThemeState {
    explicitTheme: Theme | null;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    setSystemTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const storedTheme = getStoredTheme();

export const useTheme = create<ThemeState>((set) => ({
    explicitTheme: storedTheme,
    theme: storedTheme ?? 'light',
    setTheme: (theme: Theme) => {
        set({
            explicitTheme: theme,
            theme,
        });
    },
    setSystemTheme: (theme: Theme) => {
        set((state) => {
            if (state.explicitTheme) {
                return state;
            }

            return { theme };
        });
    },
    toggleTheme: () => {
        set((state) => {
            const theme = state.theme === 'light' ? 'dark' : 'light';

            return {
                explicitTheme: theme,
                theme,
            };
        });
    },
}));

useTheme.subscribe((state) => {
    applyThemeClass(state.theme, { persist: state.explicitTheme === state.theme });
});
