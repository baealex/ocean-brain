import { create } from 'zustand';

export type Theme = 'light' | 'dark';

export interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

export const useTheme = create<ThemeState>((set) => ({
    theme: 'light',
    setTheme: (theme: Theme) => {
        set({ theme });
    },
    toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' }));
    }
}));

useTheme.subscribe((state) => {
    localStorage.setItem('theme', state.theme);
    document.documentElement.classList.add(state.theme);
    document.documentElement.classList.remove(state.theme === 'dark' ? 'light' : 'dark');
});
