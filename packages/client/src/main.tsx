import React from 'react';
import ReactDOM from 'react-dom/client';
import '@blocknote/mantine/style.css';

import App from './App.tsx';
import { initializeTheme } from './store/theme-dom.ts';
import { useTheme } from './store/theme.tsx';

import './styles/main.scss';
import './styles/tailwind.css';

useTheme.setState({ theme: initializeTheme() });

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
