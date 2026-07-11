import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';

import RestoreParentScroll from './RestoreParentScroll';

const useLocationMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    useLocation: (options: { select: (location: { pathname: string }) => string }) => useLocationMock(options),
}));

describe('<RestoreParentScroll />', () => {
    beforeEach(() => {
        useLocationMock.mockReset();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            callback(0);
            return 0;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('resets the parent scroll when the next route has no saved position', () => {
        let pathname = '/';
        useLocationMock.mockImplementation((options: { select: (location: { pathname: string }) => string }) =>
            options.select({ pathname }),
        );

        const { container, rerender } = render(
            <div>
                <RestoreParentScroll />
            </div>,
        );
        const scrollContainer = container.firstElementChild as HTMLDivElement;

        scrollContainer.scrollTop = 240;
        fireEvent.scroll(scrollContainer);

        pathname = '/notes/1';
        rerender(
            <div>
                <RestoreParentScroll />
            </div>,
        );

        expect(scrollContainer.scrollTop).toBe(0);
    });

    it('restores the saved parent scroll when returning to a route', () => {
        let pathname = '/';
        useLocationMock.mockImplementation((options: { select: (location: { pathname: string }) => string }) =>
            options.select({ pathname }),
        );

        const { container, rerender } = render(
            <div>
                <RestoreParentScroll />
            </div>,
        );
        const scrollContainer = container.firstElementChild as HTMLDivElement;

        scrollContainer.scrollTop = 240;
        fireEvent.scroll(scrollContainer);

        pathname = '/notes/1';
        rerender(
            <div>
                <RestoreParentScroll />
            </div>,
        );

        scrollContainer.scrollTop = 80;
        fireEvent.scroll(scrollContainer);

        pathname = '/';
        rerender(
            <div>
                <RestoreParentScroll />
            </div>,
        );

        expect(scrollContainer.scrollTop).toBe(240);
    });
});
