import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '~/app/App.tsx';

import '@/app/styles/main.scss';
import '@/app/styles/tailwind.css';
import '@blocknote/mantine/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
