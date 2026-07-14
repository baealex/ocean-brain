import { handyMediaQuery } from '@baejino/handy';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';

import { Providers } from '~/components/app';
import { useTheme } from '~/store/theme';

import { router } from './router';

function App() {
    const setSystemTheme = useTheme((state) => state.setSystemTheme);

    useEffect(() => {
        return handyMediaQuery.listenThemeChange((isDark) => {
            setSystemTheme(isDark ? 'dark' : 'light');
        }, true);
    }, [setSystemTheme]);

    return (
        <Providers>
            <RouterProvider router={router} />
        </Providers>
    );
}

export default App;
