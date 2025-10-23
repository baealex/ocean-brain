import { createReactBlockSpec } from '@blocknote/react';
import { useBlockNoteEditor } from '@blocknote/react';
import type { Block } from '@blocknote/core';
import { useEffect, useState } from 'react';
import { RiListOrdered } from 'react-icons/ri';

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
            <div className="w-full border-l-4 border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50 rounded-r-lg p-6">
                <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                    <RiListOrdered className="text-2xl flex-shrink-0" />
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
        <div className="w-full border-l-4 border-blue-500 dark:border-blue-400 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/30 dark:to-transparent rounded-r-lg p-6">
            <div className="flex items-center gap-2 mb-4">
                <RiListOrdered className="text-xl text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
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
                                block w-full text-left rounded-md px-3 py-2 transition-all duration-150
                                hover:bg-blue-100 dark:hover:bg-blue-900/30
                                hover:translate-x-1
                                ${isTopLevel
                                    ? 'text-sm font-semibold text-zinc-900 dark:text-zinc-100'
                                    : 'text-sm text-zinc-700 dark:text-zinc-300'
                                }
                            `}
                            style={{ paddingLeft: `${12 + indent}px` }}>
                            <span className="flex items-center gap-2">
                                {isTopLevel && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 flex-shrink-0" />
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
}, { render: () => <TableOfContentsComponent /> });

export default TableOfContents;
