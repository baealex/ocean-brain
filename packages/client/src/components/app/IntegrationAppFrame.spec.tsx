import { act, render, screen } from '@testing-library/react';
import { IntegrationAppFrame } from './IntegrationAppFrame';

describe('<IntegrationAppFrame />', () => {
    it('negotiates host capabilities and forwards valid app requests', () => {
        const onLocationChange = vi.fn();
        const onOpenNote = vi.fn();
        render(
            <IntegrationAppFrame
                title="Search app"
                src="https://app.example/"
                appLocation="/?query=whale"
                onLocationChange={onLocationChange}
                onOpenNote={onOpenNote}
            />,
        );
        const frame = screen.getByTitle('Search app');
        const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage');

        act(() => {
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'null',
                    source: frame.contentWindow,
                    data: { type: 'ocean-brain:app-ready', version: 1 },
                }),
            );
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'null',
                    source: frame.contentWindow,
                    data: { type: 'ocean-brain:location-change', version: 1, location: '/?query=coral&page=2' },
                }),
            );
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'null',
                    source: frame.contentWindow,
                    data: { type: 'ocean-brain:open-note', version: 1, noteId: '17' },
                }),
            );
        });

        expect(postMessage).toHaveBeenCalledWith(
            {
                type: 'ocean-brain:host-context',
                version: 1,
                capabilities: ['location', 'open-note', 'appearance'],
                location: '/?query=whale',
                appearance: expect.objectContaining({ theme: 'light', variables: expect.any(Object) }),
            },
            '*',
        );
        expect(onLocationChange).toHaveBeenCalledWith('/?query=coral&page=2');
        expect(onOpenNote).toHaveBeenCalledWith('17');
    });

    it('shares the current palette and updates it without reloading the app', async () => {
        const root = document.documentElement;
        const previousClass = root.className;
        const previousStyle = root.getAttribute('style');
        try {
            root.classList.add('dark');
            root.style.setProperty('--page-bg', '#101318');
            render(<IntegrationAppFrame title="Themed app" src="https://app.example/?query=whale" />);
            const frame = screen.getByTitle('Themed app');
            const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage');
            act(() => {
                window.dispatchEvent(
                    new MessageEvent('message', {
                        origin: 'null',
                        source: frame.contentWindow,
                        data: { type: 'ocean-brain:app-ready', version: 1 },
                    }),
                );
            });
            expect(postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'ocean-brain:host-context',
                    appearance: expect.objectContaining({
                        theme: 'dark',
                        variables: expect.objectContaining({ '--page-bg': '#101318' }),
                    }),
                }),
                '*',
            );
            postMessage.mockClear();
            await act(async () => {
                root.classList.remove('dark');
                root.style.setProperty('--page-bg', '#f2f5f8');
            });
            expect(postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'ocean-brain:appearance',
                    appearance: expect.objectContaining({
                        theme: 'light',
                        variables: expect.objectContaining({ '--page-bg': '#f2f5f8' }),
                    }),
                }),
                '*',
            );
            expect(screen.getByTitle('Themed app')).toBe(frame);
            expect(frame).toHaveAttribute('src', 'https://app.example/?query=whale');
        } finally {
            root.className = previousClass;
            if (previousStyle === null) root.removeAttribute('style');
            else root.setAttribute('style', previousStyle);
        }
    });

    it('restores host history state without reloading the iframe', () => {
        const { rerender } = render(
            <IntegrationAppFrame
                title="Search app"
                src="https://app.example/?query=first"
                appLocation="/?query=first"
            />,
        );
        const frame = screen.getByTitle('Search app');
        const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage');

        rerender(
            <IntegrationAppFrame
                title="Search app"
                src="https://app.example/?query=second"
                appLocation="/?query=second"
            />,
        );

        expect(frame).toHaveAttribute('src', 'https://app.example/?query=first');
        expect(postMessage).toHaveBeenCalledWith(
            { type: 'ocean-brain:location', version: 1, location: '/?query=second' },
            '*',
        );
    });

    it('ignores messages from another source and unsafe app locations', () => {
        const onLocationChange = vi.fn();
        const onOpenNote = vi.fn();
        render(
            <IntegrationAppFrame
                title="Search app"
                src="https://app.example/"
                onLocationChange={onLocationChange}
                onOpenNote={onOpenNote}
            />,
        );
        const frame = screen.getByTitle('Search app');

        act(() => {
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'https://app.example',
                    source: frame.contentWindow,
                    data: { type: 'ocean-brain:location-change', version: 1, location: '/?query=coral' },
                }),
            );
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'null',
                    source: frame.contentWindow,
                    data: { type: 'ocean-brain:location-change', version: 1, location: '/../settings' },
                }),
            );
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'null',
                    source: frame.contentWindow,
                    data: { type: 'ocean-brain:open-note', version: 1, noteId: '../settings' },
                }),
            );
        });

        expect(onLocationChange).not.toHaveBeenCalled();
        expect(onOpenNote).not.toHaveBeenCalled();
    });
});
