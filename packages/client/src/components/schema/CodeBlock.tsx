import type { defaultBlockSpecs } from '@blocknote/core';
import type { ReactCustomBlockRenderProps } from '@blocknote/react';
import { useCallback, useRef } from 'react';
import { CodeBlockCopyButton } from './CodeBlockCopyButton';

type DefaultCodeBlockSpec = typeof defaultBlockSpecs.codeBlock;
type CodeBlockProps = ReactCustomBlockRenderProps<'codeBlock', DefaultCodeBlockSpec['config']['propSchema'], 'inline'>;

export const CodeBlock = ({ contentRef }: CodeBlockProps) => {
    const codeRef = useRef<HTMLElement | null>(null);

    const setCodeRef = useCallback(
        (element: HTMLElement | null) => {
            codeRef.current = element;
            contentRef(element);
        },
        [contentRef],
    );

    return (
        <>
            <pre>
                <code ref={setCodeRef} />
            </pre>
            <CodeBlockCopyButton getText={() => codeRef.current?.textContent?.trimEnd() ?? ''} />
        </>
    );
};
