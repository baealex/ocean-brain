import { filterSuggestionItems } from '@blocknote/core';
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { RiListOrdered } from 'react-icons/ri';

import type schema from '../schema';

interface CommandViewProps {
    editor: typeof schema['BlockNoteEditor'];
}

const CommandView = ({ editor }: CommandViewProps) => {
    return (
        <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
                filterSuggestionItems(
                    [
                        ...getDefaultReactSlashMenuItems(editor).filter((item) =>
                            item.title !== 'Audio' &&
                            item.title !== 'Video' &&
                            item.title !== 'File'
                        ),
                        {
                            title: 'Table of Contents',
                            subtext: 'Insert a table of contents based on headings',
                            onItemClick: () => {
                                editor.insertBlocks(
                                    [{ type: 'tableOfContents' }],
                                    editor.getTextCursorPosition().block,
                                    'after'
                                );
                            },
                            aliases: ['toc', 'table of contents', 'contents', 'outline', 'index'],
                            group: 'Other',
                            icon: <RiListOrdered />
                        }
                    ],
                    query
                )
            }
        />
    );
};

export default CommandView;
