import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';
import { getStoredTheme, initializeTheme } from './store/theme-dom.ts';
import { useTheme } from './store/theme.tsx';

import './styles/main.scss';
import './styles/tailwind.css';
import '@blocknote/mantine/style.css';

const storedTheme = getStoredTheme();

useTheme.setState({ theme: initializeTheme() });

if (!storedTheme && typeof window !== 'undefined') {
    window.localStorage.removeItem('theme');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
