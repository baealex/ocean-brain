import { filterSuggestionItems } from '@blocknote/core';
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';

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
                    [...getDefaultReactSlashMenuItems(editor).filter((item) =>
                        item.title !== 'Audio' &&
                        item.title !== 'Video' &&
                        item.title !== 'File'
                    )],
                    query
                )
            }
        />
    );
};

export default CommandView;
