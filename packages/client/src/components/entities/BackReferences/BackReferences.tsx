import { useSuspenseQuery } from '@tanstack/react-query';
import type { Note } from '~/models/note.model';
import { getBackReferencesQueryKey } from '~/modules/query-key-factory';
import { fetchBackReferences } from '~/apis/note.api';

interface BackReferencesProps {
    noteId?: string;
    render: (notes?: Pick<Note, 'id' | 'title'>[]) => React.ReactNode;
}

const BackReferences = (props: BackReferencesProps) => {
    const { data } = useSuspenseQuery({
        queryKey: [getBackReferencesQueryKey(props.noteId!)],
        async queryFn() {
            const response = await fetchBackReferences(props.noteId!);
            if (response.type === 'error') {
                throw response;
            }
            return response.backReferences;
        }
    });

    return props.render(data);
};

export default BackReferences;
