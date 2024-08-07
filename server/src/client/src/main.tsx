import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';

import './styles/main.scss';
import './styles/tailwind.css';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
