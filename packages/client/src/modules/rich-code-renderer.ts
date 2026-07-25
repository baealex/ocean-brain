export type RichCodeKind = 'mermaid' | 'math';
export type RichCodeTheme = 'light' | 'dark';

export interface RichCodeRenderResult {
    html: string;
    bindFunctions?: (element: Element) => void;
}

let mermaidPromise: Promise<typeof import('mermaid')['default']> | undefined;
let katexPromise: Promise<typeof import('katex')['default']> | undefined;

const loadMermaid = () => {
    mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => mermaid);

    return mermaidPromise;
};

const loadKatex = () => {
    katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
        ([{ default: katex }]) => katex,
    );

    return katexPromise;
};

export const getRichCodeKind = (language: string | undefined): RichCodeKind | null => {
    const normalizedLanguage = language?.trim().toLowerCase();

    if (normalizedLanguage === 'mermaid') {
        return 'mermaid';
    }

    if (normalizedLanguage === 'math' || normalizedLanguage === 'katex' || normalizedLanguage === 'latex') {
        return 'math';
    }

    return null;
};

const getSafeMermaidId = (renderId: string) => {
    const normalizedId = renderId.replace(/[^a-zA-Z0-9_-]/g, '');
    return `ocean-brain-mermaid-${normalizedId || 'diagram'}`;
};

export const renderRichCode = async (
    kind: RichCodeKind,
    source: string,
    renderId: string,
    theme: RichCodeTheme = 'light',
): Promise<RichCodeRenderResult> => {
    if (kind === 'mermaid') {
        const mermaid = await loadMermaid();
        mermaid.initialize({
            securityLevel: 'strict',
            startOnLoad: false,
            suppressErrorRendering: true,
            theme: theme === 'dark' ? 'dark' : 'default',
        });
        const result = await mermaid.render(getSafeMermaidId(renderId), source);

        return {
            html: result.svg,
            bindFunctions: result.bindFunctions,
        };
    }

    const katex = await loadKatex();

    return {
        html: katex.renderToString(source, {
            displayMode: true,
            output: 'htmlAndMathml',
            strict: 'warn',
            throwOnError: true,
            trust: false,
        }),
    };
};
