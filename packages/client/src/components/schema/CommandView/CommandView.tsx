import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { getDefaultReactSlashMenuItems, SuggestionMenuController } from '@blocknote/react';
import * as Icon from '~/components/icon';

import type schema from '../schema';

interface CommandViewProps {
    editor: (typeof schema)['BlockNoteEditor'];
}

export const getRichCodeSlashMenuItems = (editor: CommandViewProps['editor']) => [
    {
        title: 'Diagram',
        subtext: 'Create a flowchart or diagram with Mermaid syntax',
        onItemClick: () => {
            insertOrUpdateBlockForSlashMenu(editor, {
                type: 'codeBlock',
                props: { language: 'mermaid' },
            });
        },
        aliases: ['mermaid', 'diagram', 'flowchart', 'sequence'],
        group: 'Other',
        icon: <Icon.Diagram />,
    },
    {
        title: 'Math Formula',
        subtext: 'Write a formula with KaTeX or LaTeX',
        onItemClick: () => {
            insertOrUpdateBlockForSlashMenu(editor, {
                type: 'codeBlock',
                props: { language: 'math' },
            });
        },
        aliases: ['math', 'formula', 'equation', 'katex', 'latex'],
        group: 'Other',
        icon: <Icon.Formula />,
    },
];

const CommandView = ({ editor }: CommandViewProps) => {
    return (
        <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
                filterSuggestionItems(
                    [
                        ...getDefaultReactSlashMenuItems(editor).filter(
                            (item) => item.title !== 'Audio' && item.title !== 'Video' && item.title !== 'File',
                        ),
                        ...getRichCodeSlashMenuItems(editor),
                        {
                            title: 'Table of Contents',
                            subtext: 'Insert a table of contents based on headings',
                            onItemClick: () => {
                                editor.insertBlocks(
                                    [{ type: 'tableOfContents' }],
                                    editor.getTextCursorPosition().block,
                                    'after',
                                );
                            },
                            aliases: ['toc', 'table of contents', 'contents', 'outline', 'index'],
                            group: 'Other',
                            icon: <Icon.List />,
                        },
                    ],
                    query,
                )
            }
        />
    );
};

export default CommandView;
