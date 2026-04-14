import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchBackReferences } from '~/apis/note.api';
import type { Note } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';

interface BackReferencesProps {
    noteId?: string;
    render: (notes?: Pick<Note, 'id' | 'title'>[]) => React.ReactNode;
}

const BackReferences = (props: BackReferencesProps) => {
    const { data } = useSuspenseQuery({
        queryKey: queryKeys.notes.backReferences(props.noteId!),
        async queryFn() {
            const response = await fetchBackReferences(props.noteId!);
            if (response.type === 'error') {
                throw response;
            }
            return response.backReferences;
        },
    });

    return props.render(data);
};

export default BackReferences;
