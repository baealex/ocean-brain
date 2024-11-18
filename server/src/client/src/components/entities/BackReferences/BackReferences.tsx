import { useQuery } from 'react-query';
import type { Note } from '~/models/Note';
import { graphQuery } from '~/modules/graph-query';
import { getBackReferencesQueryKey } from '~/modules/query-key-factory';

interface BackReferencesProps {
    noteId?: string;
    render: (notes?: Pick<Note, 'id' | 'title'>[]) => React.ReactNode;
}

const BackReferences = (props: BackReferencesProps) => {
    const { data } = useQuery(getBackReferencesQueryKey(props.noteId!), async () => {
        const { backReferences } = await graphQuery<{
            backReferences: Pick<Note, 'id' | 'title'>[];
        }>(`
            query {
                backReferences(id: "${props.noteId}") {
                    id
                    title
                }
            }
        `);
        return backReferences;
    }, {
        enabled: !!props.noteId,
        suspense: true
    });

    return props.render(data);
};

export default BackReferences;
