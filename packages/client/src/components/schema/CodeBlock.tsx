import type { defaultBlockSpecs } from '@blocknote/core';
import type { ReactCustomBlockRenderProps } from '@blocknote/react';
import classNames from 'classnames';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Icon from '~/components/icon';
import { getRichCodeKind } from '~/modules/rich-code-renderer';
import { CodeBlockCopyButton } from './CodeBlockCopyButton';
import { RichCodePreview } from './RichCodePreview';

type DefaultCodeBlockSpec = typeof defaultBlockSpecs.codeBlock;
type CodeBlockProps = ReactCustomBlockRenderProps<DefaultCodeBlockSpec['config']>;

const modeButtonClassName =
    'focus-ring-soft inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-semibold outline-none transition-colors';

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
    const richCodeLabel = kind === 'mermaid' ? 'Diagram' : 'Math Formula';
    const controlsLabel = `${richCodeLabel} controls`;

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
            {kind && (
                <div
                    role="toolbar"
                    aria-label={controlsLabel}
                    data-rich-code-toolbar
                    className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-elevated px-3 py-1.5 text-fg-secondary"
                    contentEditable={false}
                    onMouseDown={preventEditorFocus}
                >
                    <div className="flex min-w-0 items-center gap-2 px-1 text-xs font-semibold text-fg-secondary">
                        {kind === 'mermaid' ? (
                            <Icon.Diagram className="h-4 w-4 shrink-0 text-fg-tertiary" />
                        ) : (
                            <Icon.Formula className="h-4 w-4 shrink-0 text-fg-tertiary" />
                        )}
                        <span className="truncate">{richCodeLabel}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex items-center gap-0.5 rounded-[10px] border border-border-subtle bg-hover-subtle/55 p-0.5">
                            <button
                                type="button"
                                aria-pressed={showSource}
                                className={classNames(
                                    modeButtonClassName,
                                    showSource
                                        ? 'border-border-secondary/70 bg-elevated text-fg-default shadow-[0_8px_18px_-16px_rgba(15,18,24,0.28)]'
                                        : 'border-transparent text-fg-secondary hover:bg-hover-subtle hover:text-fg-default',
                                )}
                                contentEditable={false}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setShowSource(true);
                                }}
                            >
                                <Icon.Edit className="h-3.5 w-3.5" />
                                Edit
                            </button>
                            <button
                                type="button"
                                aria-pressed={showPreview}
                                className={classNames(
                                    modeButtonClassName,
                                    showPreview
                                        ? 'border-border-secondary/70 bg-elevated text-fg-default shadow-[0_8px_18px_-16px_rgba(15,18,24,0.28)]'
                                        : 'border-transparent text-fg-secondary hover:bg-hover-subtle hover:text-fg-default',
                                )}
                                contentEditable={false}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setShowSource(false);
                                }}
                            >
                                <Icon.Eye className="h-3.5 w-3.5" />
                                Preview
                            </button>
                        </div>
                        <CodeBlockCopyButton
                            variant="toolbar"
                            getText={() => codeRef.current?.textContent?.trimEnd() ?? ''}
                        />
                    </div>
                </div>
            )}
            <pre className={showPreview ? 'hidden' : undefined}>
                <code ref={setCodeRef} />
            </pre>
            {kind && showPreview && <RichCodePreview kind={kind} source={source} />}
            {!kind && <CodeBlockCopyButton getText={() => codeRef.current?.textContent?.trimEnd() ?? ''} />}
        </>
    );
};
