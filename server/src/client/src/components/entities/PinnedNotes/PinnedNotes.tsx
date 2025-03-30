import { useSuspenseQuery } from '@tanstack/react-query';
import type { Note } from '~/models/Note';
import { graphQuery } from '~/modules/graph-query';
import { getPinnedNoteQueryKey } from '~/modules/query-key-factory';

interface PinnedNotesProps {
    render: (notes?: Pick<Note, 'id' | 'title'>[]) => React.ReactNode;
}

const PinnedNotes = (props: PinnedNotesProps) => {
    const { data: pinnedNotes } = useSuspenseQuery({
        queryKey: [getPinnedNoteQueryKey()],
        async queryFn() {
            const response = await graphQuery<{
                pinnedNotes: Pick<Note, 'id' | 'title'>[];
            }>(`
                query {
                    pinnedNotes {
                        id
                        title
                    }
                }
            `);
            if (response.type === 'error') {
                throw response;
            }
            return response.pinnedNotes;
        }
    });

    return props.render(pinnedNotes);
};

export default PinnedNotes;
