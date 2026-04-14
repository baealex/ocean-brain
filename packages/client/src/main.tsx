import React from 'react';
import ReactDOM from 'react-dom/client';
import '@blocknote/mantine/style.css';

import App from './App.tsx';
import { useTheme } from './store/theme.tsx';
import { initializeTheme } from './store/theme-dom.ts';

import './styles/main.scss';
import './styles/tailwind.css';

useTheme.setState({ theme: initializeTheme() });

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
