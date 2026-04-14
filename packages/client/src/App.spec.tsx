import type * as TanStackRouter from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';

vi.mock('@baejino/handy', () => ({ handyMediaQuery: { listenThemeChange: () => () => undefined } }));

vi.mock('@tanstack/react-router', async () => {
    const actual = await vi.importActual<typeof TanStackRouter>('@tanstack/react-router');

    return {
        ...actual,
        RouterProvider: () => <div>Router Provider</div>,
    };
});

vi.mock('./router', () => ({ router: {} }));

import App from './App';

describe('App', () => {
    it('renders the App component', () => {
        render(<App />);

        expect(screen.getByText('Router Provider')).toBeInTheDocument();
    });
});
