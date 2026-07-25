import { useEffect, useId, useRef, useState } from 'react';
import { type RichCodeKind, renderRichCode } from '~/modules/rich-code-renderer';
import { useTheme } from '~/store/theme';

interface RichCodePreviewProps {
    kind: RichCodeKind;
    source: string;
}

type PreviewState =
    | { status: 'idle' | 'loading' }
    | { status: 'success'; html: string; bindFunctions?: (element: Element) => void }
    | { status: 'error' };

export const RichCodePreview = ({ kind, source }: RichCodePreviewProps) => {
    const renderId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const theme = useTheme((state) => state.theme);
    const [shouldRender, setShouldRender] = useState(() => typeof IntersectionObserver === 'undefined');
    const [state, setState] = useState<PreviewState>({ status: 'idle' });

    useEffect(() => {
        const element = rootRef.current;

        if (shouldRender || !element || typeof IntersectionObserver === 'undefined') {
            setShouldRender(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    setShouldRender(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '240px' },
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [shouldRender]);

    useEffect(() => {
        if (!shouldRender) {
            return;
        }

        let cancelled = false;
        setState({ status: 'loading' });

        renderRichCode(kind, source, renderId, theme)
            .then((result) => {
                if (!cancelled) {
                    setState({ status: 'success', ...result });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setState({ status: 'error' });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [kind, renderId, shouldRender, source, theme]);

    useEffect(() => {
        if (state.status === 'success' && state.bindFunctions && rootRef.current) {
            state.bindFunctions(rootRef.current);
        }
    }, [state]);

    return (
        <div
            ref={rootRef}
            data-rich-code-preview
            className="min-h-24 w-full overflow-auto bg-surface px-4 py-5 text-fg-default sm:px-6 sm:py-6"
            contentEditable={false}
            aria-label={kind === 'mermaid' ? 'Mermaid diagram preview' : 'Math formula preview'}
        >
            {state.status === 'success' && (
                <div
                    className="[&_.katex-display]:m-0 [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-[min(68vh,640px)] [&_svg]:max-w-full"
                    // Mermaid runs in strict mode and KaTeX runs with trust disabled.
                    // Both libraries return the HTML required for their visual output.
                    dangerouslySetInnerHTML={{ __html: state.html }}
                />
            )}
            {(state.status === 'idle' || state.status === 'loading') && (
                <div className="flex min-h-8 items-center justify-center text-sm text-black/55">Rendering preview…</div>
            )}
            {state.status === 'error' && (
                <div className="text-left">
                    <p className="mb-3 text-sm text-red-700">Preview could not be rendered. The source is preserved.</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-[6px] bg-black/5 p-4 text-sm text-black">
                        <code>{source}</code>
                    </pre>
                </div>
            )}
        </div>
    );
};
