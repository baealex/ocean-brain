import { type ReactNode, useLayoutEffect, useRef } from 'react';

const FOCUS_PADDING = 8;

const revealFocusedInput = (root: HTMLElement, viewport: VisualViewport) => {
    const input = document.activeElement;
    if (
        !(input instanceof HTMLElement) ||
        !root.contains(input) ||
        !(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input.isContentEditable)
    )
        return;

    const body = input.closest<HTMLElement>('[data-dialog-body]');
    if (!body || !root.contains(body)) return;
    const bounds = input.getBoundingClientRect();
    const bodyBounds = body.getBoundingClientRect();
    const top = Math.max(bodyBounds.top, viewport.offsetTop) + FOCUS_PADDING;
    const bottom = Math.min(bodyBounds.bottom, viewport.offsetTop + viewport.height) - FOCUS_PADDING;
    if (bottom <= top) return;

    // Scroll only the sheet body. Moving document scroll or focus fights the IME.
    if (bounds.top < top) body.scrollTop += bounds.top - top;
    else if (bounds.bottom > bottom) body.scrollTop += bounds.bottom - bottom;
};

export const DialogViewport = ({ avoidKeyboard, children }: { avoidKeyboard: boolean; children: ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const root = ref.current;
        const viewport = window.visualViewport;
        if (!avoidKeyboard || !root || !viewport) return;

        const mobile = window.matchMedia('(max-width: 639px)');
        let frame: number | undefined;
        const reset = () => {
            root.style.removeProperty('--dialog-viewport-height');
            root.style.removeProperty('--dialog-viewport-top');
        };
        const update = () => {
            frame = undefined;
            // Preserve desktop layout and native pinch zoom behavior.
            if (!mobile.matches || viewport.scale !== 1 || viewport.height <= 0) {
                reset();
                return;
            }
            root.style.setProperty('--dialog-viewport-height', `${viewport.height}px`);
            root.style.setProperty('--dialog-viewport-top', `${viewport.offsetTop}px`);
            revealFocusedInput(root, viewport);
        };
        const schedule = () => {
            if (frame === undefined) frame = window.requestAnimationFrame(update);
        };

        update();
        viewport.addEventListener('resize', schedule);
        viewport.addEventListener('scroll', schedule);
        mobile.addEventListener('change', schedule);
        root.addEventListener('focusin', schedule);
        return () => {
            if (frame !== undefined) window.cancelAnimationFrame(frame);
            viewport.removeEventListener('resize', schedule);
            viewport.removeEventListener('scroll', schedule);
            mobile.removeEventListener('change', schedule);
            root.removeEventListener('focusin', schedule);
            reset();
        };
    }, [avoidKeyboard]);

    return (
        <div
            ref={ref}
            className="pointer-events-none fixed inset-x-0 top-[var(--dialog-viewport-top,0px)] z-[1100] flex h-[var(--dialog-viewport-height,100%)] items-end justify-center p-0 sm:top-0 sm:h-full sm:items-center sm:p-4"
        >
            {children}
        </div>
    );
};
