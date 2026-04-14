import { handyMediaQuery } from '@baejino/handy';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';

import { Providers } from '~/components/app';
import { useTheme } from '~/store/theme';
import { getStoredTheme } from '~/store/theme-dom';

import { router } from './router';

function App() {
    const setSystemTheme = useTheme((state) => state.setSystemTheme);
    const setTheme = useTheme((state) => state.setTheme);

    useEffect(() => {
        const storedTheme = getStoredTheme();

        if (storedTheme) {
            setTheme(storedTheme);
        }

        return handyMediaQuery.listenThemeChange((isDark) => {
            if (!getStoredTheme()) {
                setSystemTheme(isDark ? 'dark' : 'light');
            }
        }, storedTheme == null);
    }, [setSystemTheme, setTheme]);

    return (
        <Providers>
            <RouterProvider router={router} />
        </Providers>
    );
}

export default App;
