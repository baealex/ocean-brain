import React from 'react';
import ReactDOM from 'react-dom/client';
import '@blocknote/mantine/style.css';

import App from './App.tsx';
import { installAuthRedirectInterceptor } from './modules/auth-redirect.ts';
import { useTheme } from './store/theme.tsx';
import { initializeTheme } from './store/theme-dom.ts';

import './styles/main.scss';
import './styles/tailwind.css';

if (import.meta.env.DEV) {
    void import('react-grab');
}

useTheme.setState({ theme: initializeTheme() });
installAuthRedirectInterceptor();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
