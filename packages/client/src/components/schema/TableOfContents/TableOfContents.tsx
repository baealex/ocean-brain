import { createReactBlockSpec } from '@blocknote/react';
import { useBlockNoteEditor } from '@blocknote/react';
import type { Block } from '@blocknote/core';
import { useEffect, useState } from 'react';
import classNames from 'classnames';
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
    const tocIndentClass: Record<number, string> = {
        1: 'pl-3',
        2: 'pl-[26px]',
        3: 'pl-[40px]',
        4: 'pl-[54px]',
        5: 'pl-[68px]',
        6: 'pl-[82px]'
    };

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

    const header = (
        <div className="flex items-center gap-2">
            <Icon.List className="h-3.5 w-3.5 shrink-0 text-fg-tertiary" />
            <span className="text-label font-semibold uppercase tracking-[0.12em] text-fg-tertiary">
                Table of Contents
            </span>
        </div>
    );

    if (headings.length === 0) {
        return (
            <div className="surface-base w-full p-4">
                {header}
                <p className="mt-2 text-meta text-fg-tertiary">
                    Add headings to your document to generate a table of contents
                </p>
            </div>
        );
    }

    return (
        <div className="surface-base w-full p-4">
            <div className="mb-2">{header}</div>
            <nav className="space-y-0.5">
                {headings.map((heading) => {
                    const isTopLevel = heading.level === 1;

                    return (
                        <button
                            key={heading.id}
                            type="button"
                            onClick={() => scrollToHeading(heading.id)}
                            className={classNames(
                                'focus-ring-soft',
                                'flex',
                                'w-full',
                                'items-center',
                                'gap-2',
                                'rounded-[10px]',
                                'px-2.5',
                                'py-1.5',
                                tocIndentClass[heading.level] ?? 'pl-2.5',
                                'text-left',
                                'transition-colors',
                                'hover:bg-hover-subtle',
                                isTopLevel ? 'text-fg-default' : 'text-fg-secondary'
                            )}>
                            <span className="text-label min-w-[1.5rem] font-semibold uppercase tracking-[0.08em] text-fg-tertiary">
                                H{heading.level}
                            </span>
                            <span className={`text-meta line-clamp-2 ${isTopLevel ? 'font-semibold' : 'font-medium'}`}>
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
