import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { issueProxiedAppAccess } from '~/apis/app-gateway.api';
import { ProxiedAppFrame } from './ProxiedAppFrame';

vi.mock('~/apis/app-gateway.api', () => ({ issueProxiedAppAccess: vi.fn() }));

const access = {
    connectionId: 'search-1',
    token: 'short-lived-access-token',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
};

describe('<ProxiedAppFrame />', () => {
    beforeEach(() => {
        vi.mocked(issueProxiedAppAccess).mockResolvedValue(access);
    });

    it('opens the canonical sandboxed app path and answers its ready handshake', async () => {
        render(<ProxiedAppFrame connectionId="search-1" title="Search app" className="h-full" />);

        const iframe = await screen.findByTitle('Search app');
        expect(iframe).toHaveAttribute('src', '/apps/search-1/');
        expect(iframe).toHaveAttribute('sandbox', 'allow-downloads allow-forms allow-modals allow-scripts');
        expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');
        const postMessage = vi.spyOn(iframe.contentWindow as Window, 'postMessage');

        act(() => {
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'null',
                    source: iframe.contentWindow,
                    data: { type: 'ocean-brain:app-ready', version: 1 },
                }),
            );
        });

        expect(postMessage).toHaveBeenCalledWith(
            {
                type: 'ocean-brain:host-context',
                version: 1,
                capabilities: ['location', 'open-note'],
                location: '/',
            },
            '*',
        );
        expect(postMessage).toHaveBeenCalledWith(
            { type: 'ocean-brain:app-access', version: 1, token: access.token },
            '*',
        );
    });

    it('does not give an access token to messages from another window or origin', async () => {
        render(<ProxiedAppFrame connectionId="search-1" title="Search app" />);
        const iframe = await screen.findByTitle('Search app');
        const postMessage = vi.spyOn(iframe.contentWindow as Window, 'postMessage');

        act(() => {
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'https://example.com',
                    source: iframe.contentWindow,
                    data: { type: 'ocean-brain:app-ready', version: 1 },
                }),
            );
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'null',
                    source: window,
                    data: { type: 'ocean-brain:app-ready', version: 1 },
                }),
            );
        });

        expect(postMessage).not.toHaveBeenCalled();
    });

    it('offers a retry when the access grant cannot be issued', async () => {
        vi.mocked(issueProxiedAppAccess).mockRejectedValueOnce(new Error('proxy unavailable'));
        render(<ProxiedAppFrame connectionId="search-1" title="Search app" />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Could not open this app.');
        vi.mocked(issueProxiedAppAccess).mockResolvedValueOnce(access);
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => expect(screen.getByTitle('Search app')).toBeInTheDocument());
        expect(issueProxiedAppAccess).toHaveBeenCalledTimes(2);
    });
});
