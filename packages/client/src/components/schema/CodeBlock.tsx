import type { defaultBlockSpecs } from '@blocknote/core';
import type { ReactCustomBlockRenderProps } from '@blocknote/react';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Icon from '~/components/icon';
import { getRichCodeKind } from '~/modules/rich-code-renderer';
import { CodeBlockCopyButton } from './CodeBlockCopyButton';
import { RichCodePreview } from './RichCodePreview';

type DefaultCodeBlockSpec = typeof defaultBlockSpecs.codeBlock;
type CodeBlockProps = ReactCustomBlockRenderProps<DefaultCodeBlockSpec['config']>;

const getInlineText = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    if (!value || typeof value !== 'object') {
        return '';
    }

    if ('text' in value && typeof value.text === 'string') {
        return value.text;
    }

    if ('content' in value) {
        if (Array.isArray(value.content)) {
            return value.content.map(getInlineText).join('');
        }

        return getInlineText(value.content);
    }

    return '';
};

export const CodeBlock = ({ block, contentRef }: CodeBlockProps) => {
    const codeRef = useRef<HTMLElement | null>(null);
    const kind = getRichCodeKind(block.props.language);
    const initialSource = block.content.map(getInlineText).join('');
    const [source, setSource] = useState(initialSource);
    const [showSource, setShowSource] = useState(initialSource.length === 0);
    const showPreview = kind !== null && !showSource;

    const setCodeRef = useCallback(
        (element: HTMLElement | null) => {
            codeRef.current = element;
            contentRef(element);
        },
        [contentRef],
    );

    useEffect(() => {
        const element = codeRef.current;

        if (!element) {
            return;
        }

        const syncSource = () => setSource(element.textContent ?? '');
        const observer = new MutationObserver(syncSource);
        observer.observe(element, { characterData: true, childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    const preventEditorFocus = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <>
            <pre className={showPreview ? 'hidden' : undefined}>
                <code ref={setCodeRef} />
            </pre>
            {kind && showPreview && <RichCodePreview kind={kind} source={source} />}
            {kind && (
                <div
                    className="absolute right-[94px] top-2 z-[1]"
                    contentEditable={false}
                    onMouseDown={preventEditorFocus}
                >
                    <button
                        type="button"
                        className="inline-flex h-7 cursor-pointer select-none items-center gap-1.5 rounded-[8px] border border-white/10 bg-white/10 px-2.5 text-xs font-medium text-white/60 opacity-75 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white/90 hover:opacity-100 focus-ring-soft focus:text-white/90 focus:opacity-100"
                        contentEditable={false}
                        onClick={(event) => {
                            event.stopPropagation();
                            setShowSource((current) => !current);
                        }}
                    >
                        {showPreview ? <Icon.Edit className="h-3.5 w-3.5" /> : <Icon.Eye className="h-3.5 w-3.5" />}
                        {showPreview ? 'Edit' : 'Preview'}
                    </button>
                </div>
            )}
            <CodeBlockCopyButton getText={() => codeRef.current?.textContent?.trimEnd() ?? ''} />
        </>
    );
};
