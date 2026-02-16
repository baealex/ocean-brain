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
            <div className="w-full rounded-sketchy-lg border-2 border-border bg-subtle p-6">
                <div className="flex items-center gap-3 text-fg-tertiary">
                    <Icon.List className="text-2xl flex-shrink-0" />
                    <div>
                        <div className="font-medium text-base mb-1">Table of Contents</div>
                        <div className="text-sm opacity-75">
                            Add headings to your document to generate a table of contents
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full rounded-sketchy-lg border-2 border-border bg-subtle p-6">
            <div className="flex items-center gap-2 mb-4">
                <Icon.List className="text-xl text-fg-muted" />
                <h3 className="text-base font-bold text-fg">
                    Table of Contents
                </h3>
            </div>
            <nav className="space-y-0.5">
                {headings.map((heading) => {
                    const indent = (heading.level - 1) * 16;
                    const isTopLevel = heading.level === 1;

                    return (
                        <button
                            key={heading.id}
                            onClick={() => scrollToHeading(heading.id)}
                            className={`
                                block w-full text-left rounded-sketchy-sm px-3 py-2 transition-all duration-150
                                hover:bg-hover
                                hover:translate-x-1
                                ${isTopLevel
                                    ? 'text-sm font-semibold text-fg'
                                    : 'text-sm text-fg-muted'
                                }
                            `}
                            style={{ paddingLeft: `${12 + indent}px` }}>
                            <span className="flex items-center gap-2">
                                {isTopLevel && (
                                    <span className="w-2 h-2 rounded-sketchy-xs bg-fg-default flex-shrink-0" />
                                )}
                                <span className="line-clamp-2">{heading.text}</span>
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
