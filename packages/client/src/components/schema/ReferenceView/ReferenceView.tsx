import { SuggestionMenuController } from '@blocknote/react';

import { fetchNotes } from '~/apis/note.api';
import { filterReferenceSuggestionNotes } from './reference-suggestions';

interface ReferenceViewProps {
    currentNoteId?: string;
    onClick: (content: {
        type: 'reference';
        props: {
            id: string;
            title: string;
        };
    }) => void;
}

const ReferenceView = ({ currentNoteId, onClick }: ReferenceViewProps) => {
    return (
        <SuggestionMenuController
            triggerCharacter="["
            getItems={async (query) => {
                const response = await fetchNotes({
                    query,
                    limit: 5,
                });
                if (response.type === 'error') {
                    return [];
                }
                const notes = filterReferenceSuggestionNotes(response.allNotes.notes, currentNoteId);
                return notes.map((note) => ({
                    title: note.title,
                    onItemClick: () =>
                        onClick({
                            type: 'reference',
                            props: {
                                id: note.id,
                                title: note.title,
                            },
                        }),
                }));
            }}
        />
    );
};

export default ReferenceView;
