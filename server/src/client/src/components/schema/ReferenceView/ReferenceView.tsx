import { SuggestionMenuController } from '@blocknote/react';

import { fetchNotes } from '~/apis/note.api';

interface ReferenceViewProps {
    onClick: (content: {
        type: 'reference';
        props: {
            id: string;
            title: string;
        };
    }) => void;
}

const ReferenceView = ({ onClick }: ReferenceViewProps) => {
    return (
        <SuggestionMenuController
            triggerCharacter="["
            getItems={async (query) => {
                const response = await fetchNotes({
                    query,
                    limit: 5
                });
                if (response.type === 'error') {
                    return [];
                }
                const { notes } = response.allNotes;
                return notes.map(note => ({
                    title: note.title,
                    onItemClick: () => onClick({
                        type: 'reference',
                        props: {
                            id: note.id,
                            title: note.title
                        }
                    })
                }));
            }}
        />
    );
};

export default ReferenceView;
