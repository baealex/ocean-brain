import type { Block } from '@blocknote/core';
import { createReactBlockSpec, useBlockNoteEditor } from '@blocknote/react';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import * as Icon from '~/components/icon';
import { AuxiliaryPanelHeader } from '~/components/shared';
import { Text } from '~/components/ui';

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
        6: 'pl-[82px]',
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
                        const text = headingBlock.content?.map((item) => item.text || '').join('') || '';

                        if (text.trim()) {
                            extractedHeadings.push({
                                id: block.id,
                                level,
                                text,
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
                block: 'center',
            });
        }
    };

    const header = (
        <AuxiliaryPanelHeader
            icon={<Icon.List className="h-3.5 w-3.5" />}
            title="Table of Contents"
            className="text-fg-tertiary"
        />
    );

    if (headings.length === 0) {
        return (
            <div className="surface-base w-full p-4">
                {header}
                <Text as="p" variant="meta" tone="secondary" className="mt-2">
                    Add headings to your document to generate a table of contents
                </Text>
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
                                isTopLevel ? 'text-fg-default' : 'text-fg-secondary',
                            )}
                        >
                            <Text as="span" variant="label" weight="medium" tone="tertiary" className="min-w-[1.5rem]">
                                H{heading.level}
                            </Text>
                            <Text
                                as="span"
                                variant="body"
                                weight={isTopLevel ? 'semibold' : 'medium'}
                                className="line-clamp-2 text-current"
                            >
                                {heading.text}
                            </Text>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

const TableOfContents = createReactBlockSpec(
    {
        type: 'tableOfContents',
        propSchema: {},
        content: 'none',
    },
    { render: () => <TableOfContentsComponent /> },
)();

export default TableOfContents;
