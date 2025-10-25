import { handyMediaQuery } from '@baejino/handy';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import Providers from '@/app/providers/Providers';
import { useTheme, type Theme } from '~/store/theme';
import router from '@/app/router/router';

function App() {
    const { setTheme } = useTheme();

    useEffect(() => {
        const theme = localStorage.getItem('theme') as Theme;
        if (theme) {
            setTheme(theme);
        }
        return handyMediaQuery.listenThemeChange(
            isDark => setTheme(isDark ? 'dark' : 'light'),
            !theme
        );
    }, [setTheme]);

    return (
        <Providers>
            <RouterProvider router={router} />
        </Providers>
    );
}

export default App;
