import { handyMediaQuery } from '@baejino/handy';
import { useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';

import { Providers } from '~/components/app';

import { getStoredTheme } from '~/store/theme-dom';
import { useTheme } from '~/store/theme';

import { router } from './router';

function App() {
    const setTheme = useTheme((state) => state.setTheme);

    useEffect(() => {
        const storedTheme = getStoredTheme();

        if (storedTheme) {
            setTheme(storedTheme);
        }

        return handyMediaQuery.listenThemeChange(
            (isDark) => {
                if (!getStoredTheme()) {
                    setTheme(isDark ? 'dark' : 'light');
                }
            },
            storedTheme == null
        );
    }, [setTheme]);

    return (
        <Providers>
            <RouterProvider router={router} />
        </Providers>
    );
}

export default App;
