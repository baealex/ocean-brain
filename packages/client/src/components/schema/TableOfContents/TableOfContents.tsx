import { createReactBlockSpec } from '@blocknote/react';
import { useBlockNoteEditor } from '@blocknote/react';
import type { Block } from '@blocknote/core';
import { useEffect, useState } from 'react';
import * as Icon from '~/components/icon';

interface HeadingItem {
    id: string;
    level: number;
    text: string;
}

interface HeadingBlock {
    id: string;
    type: 'heading';
    props: {
        level: number;
        [key: string]: unknown;
    };
    content?: Array<{
        type: string;
        text?: string;
        styles?: Record<string, unknown>;
    }>;
    children?: Block[];
}

const TableOfContentsComponent = () => {
    const editor = useBlockNoteEditor();
    const [headings, setHeadings] = useState<HeadingItem[]>([]);

    useEffect(() => {
        const extractHeadings = () => {
            const blocks = editor.document as Block[];
            const extractedHeadings: HeadingItem[] = [];

            const traverse = (blocks: Block[]) => {
                for (const block of blocks) {
                    if (block.type === 'heading') {
                        const headingBlock = block as HeadingBlock;
                        const level = headingBlock.props.level || 1;
                        const text = headingBlock.content
                            ?.map((item) => item.text || '')
                            .join('') || '';

                        if (text.trim()) {
                            extractedHeadings.push({
                                id: block.id,
                                level,
                                text
                            });
                        }
                    }

                    if (block.children && Array.isArray(block.children)) {
                        traverse(block.children);
                    }
                }
            };

            traverse(blocks);
            setHeadings(extractedHeadings);
        };

        extractHeadings();

        const unsubscribe = editor.onChange?.(extractHeadings);
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [editor]);

    const scrollToHeading = (headingId: string) => {
        editor.setTextCursorPosition(headingId);
        const element = document.querySelector(`[data-id="${headingId}"]`);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    };

    if (headings.length === 0) {
        return (
            <div className="surface-base w-full p-5">
                <div className="flex items-start gap-3 text-fg-tertiary">
                    <Icon.List className="mt-0.5 text-xl flex-shrink-0" />
                    <div>
                        <div className="mb-1 text-sm font-semibold text-fg-default">Table of Contents</div>
                        <div className="text-sm text-fg-tertiary">
                            Add headings to your document to generate a table of contents
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="surface-base w-full p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-border-subtle pb-3">
                <Icon.List className="text-lg text-fg-tertiary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-fg-tertiary">
                    Table of Contents
                </h3>
            </div>
            <nav className="space-y-1">
                {headings.map((heading) => {
                    const indent = (heading.level - 1) * 14;
                    const isTopLevel = heading.level === 1;

                    return (
                        <button
                            key={heading.id}
                            type="button"
                            onClick={() => scrollToHeading(heading.id)}
                            className={[
                                'focus-ring-soft',
                                'flex',
                                'w-full',
                                'items-start',
                                'gap-3',
                                'rounded-[14px]',
                                'px-3',
                                'py-2.5',
                                'text-left',
                                'transition-colors',
                                'hover:bg-hover-subtle',
                                isTopLevel ? 'text-fg-default' : 'text-fg-secondary'
                            ].join(' ')}
                            style={{ paddingLeft: `${12 + indent}px` }}>
                            <span className="mt-[1px] min-w-[1.75rem] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-fg-tertiary">
                                H{heading.level}
                            </span>
                            <span className={`line-clamp-2 text-sm ${isTopLevel ? 'font-semibold' : 'font-medium'}`}>
                                {heading.text}
                            </span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

const TableOfContents = createReactBlockSpec({
    type: 'tableOfContents',
    propSchema: {},
    content: 'none'
}, { render: () => <TableOfContentsComponent /> })();

export default TableOfContents;
