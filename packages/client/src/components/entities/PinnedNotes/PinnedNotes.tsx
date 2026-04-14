import { useSuspenseQuery } from '@tanstack/react-query';
import type { Note } from '~/models/note.model';
import { graphQuery } from '~/modules/graph-query';
import { queryKeys } from '~/modules/query-key-factory';

interface PinnedNotesProps {
    render: (notes: Pick<Note, 'id' | 'title' | 'order'>[]) => React.ReactNode;
}

const PinnedNotes = (props: PinnedNotesProps) => {
    const { data: pinnedNotes } = useSuspenseQuery({
        queryKey: queryKeys.notes.pinned(),
        async queryFn() {
            const response = await graphQuery<{
                pinnedNotes: Pick<Note, 'id' | 'title' | 'order'>[];
            }>(`
                query {
                    pinnedNotes {
                        id
                        title
                        order
                    }
                }
            `);
            if (response.type === 'error') {
                throw response;
            }
            return response.pinnedNotes;
        },
    });

    return <>{props.render(pinnedNotes)}</>;
};

export default PinnedNotes;
