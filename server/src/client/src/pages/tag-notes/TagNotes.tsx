import { Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Empty, FallbackRender, Pagination, Skeleton } from '~/shared/ui';
import { NoteListCard } from '~/entities/note/ui';
// TODO: import TagNotes entity hook

import useNoteMutate from '~/shared/hooks/resource/useNoteMutate';

export default function TagNotes() {
    const { id } = useParams();

    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    const {
        onDelete,
        onPinned
    } = useNoteMutate();

    return (
        <>
            <Helmet>
                <title>Tag | Ocean Brain</title>
            </Helmet>
            <Suspense
                fallback={(
                    <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                    </div>
                )}>
                {/* TODO: Implement TagNotes with hooks pattern */}
                <Empty
                    icon="🚧"
                    title="Under Construction"
                    description="TagNotes page will be reimplemented with hooks pattern"
                />
            </Suspense>
        </>
    );
}
