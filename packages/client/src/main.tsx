import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';
import { installAuthRedirectInterceptor } from './modules/auth-redirect.ts';
import { redirectToLoginIfSessionExpired } from './modules/auth-session-recovery.ts';
import { initializeThemeSystem } from './store/theme.tsx';

import './styles/main.scss';
import './styles/tailwind.css';

if (import.meta.env.DEV) {
    void import('react-grab');
}

initializeThemeSystem();
installAuthRedirectInterceptor();
void redirectToLoginIfSessionExpired();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
