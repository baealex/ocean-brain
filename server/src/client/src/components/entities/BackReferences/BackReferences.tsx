import { useSuspenseQuery } from '@tanstack/react-query';
import type { Note } from '~/models/note.model';
import { graphQuery } from '~/modules/graph-query';
import { getBackReferencesQueryKey } from '~/modules/query-key-factory';

interface BackReferencesProps {
    noteId?: string;
    render: (notes?: Pick<Note, 'id' | 'title'>[]) => React.ReactNode;
}

const BackReferences = (props: BackReferencesProps) => {
    const { data } = useSuspenseQuery({
        queryKey: [getBackReferencesQueryKey(props.noteId!)],
        async queryFn() {
            const response = await graphQuery<{
                backReferences: Pick<Note, 'id' | 'title'>[];
            }>(`
                query {
                    backReferences(id: "${props.noteId}") {
                        id
                        title
                    }
                }
            `);
            if (response.type === 'error') {
                throw response;
            }
            return response.backReferences;
        }
    });

    return props.render(data);
};

export default BackReferences;
