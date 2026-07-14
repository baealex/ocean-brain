import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useTheme } from '~/store/theme';
import App from './App';

const mediaTheme = vi.hoisted(() => ({
    listener: null as ((isDark: boolean) => void) | null,
}));

vi.mock('@baejino/handy', () => ({
    handyMediaQuery: {
        listenThemeChange: vi.fn((listener: (isDark: boolean) => void) => {
            mediaTheme.listener = listener;
            return vi.fn();
        }),
    },
}));
vi.mock('@tanstack/react-router', () => ({ RouterProvider: () => null }));
vi.mock('~/components/app', () => ({ Providers: ({ children }: { children: ReactNode }) => children }));
vi.mock('./router', () => ({ router: {} }));

const originalState = useTheme.getState();

describe('<App /> theme listener', () => {
    afterEach(() => {
        useTheme.setState(originalState);
        localStorage.clear();
        mediaTheme.listener = null;
    });

    it('tracks operating-system changes while an explicit theme remains active', () => {
        useTheme.getState().setTheme('light');
        render(<App />);

        mediaTheme.listener?.(true);

        expect(useTheme.getState().theme).toBe('light');
        expect(useTheme.getState().systemTheme).toBe('dark');

        useTheme.getState().setColorMode('system');
        expect(useTheme.getState().theme).toBe('dark');
    });

    it('does not let a stale legacy key replace current appearance preferences', () => {
        useTheme.getState().setColorMode('system');
        localStorage.setItem('theme', 'dark');

        render(<App />);

        expect(useTheme.getState().colorMode).toBe('system');
        expect(localStorage.getItem('theme')).toBe('dark');
    });
});
