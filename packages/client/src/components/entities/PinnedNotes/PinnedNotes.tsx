import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchPinnedNotes } from '~/apis/note.api';
import type { Note } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';
import { workspaceScope } from '~/modules/workspace-scope';
import { useWorkspace } from '~/store/workspace';

interface PinnedNotesProps {
    render: (notes: Pick<Note, 'id' | 'title' | 'order'>[]) => React.ReactNode;
}

const PinnedNotes = (props: PinnedNotesProps) => {
    const { workspaceId } = useWorkspace();
    const scope = workspaceScope(workspaceId);
    const { data: pinnedNotes } = useSuspenseQuery({
        queryKey: queryKeys.notes.pinned(scope),
        async queryFn() {
            const response = await fetchPinnedNotes(scope);
            if (response.type === 'error') {
                throw response;
            }
            return response.pinnedNotes;
        },
    });

    return <>{props.render(pinnedNotes)}</>;
};

export default PinnedNotes;
