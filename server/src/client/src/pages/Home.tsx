import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
    Empty, FallbackRender, NoteFilters, PageLayout, Pagination, Skeleton
} from '~/components/shared';
import { NoteListCard } from '~/components/note';
import { Notes } from '~/components/entities';

import useNoteMutate from '~/hooks/resource/useNoteMutate';
import { useGridLimit } from '~/hooks/useGridLimit';

import type { SortBy, SortOrder } from '~/components/shared/NoteFilters';

const CARD_MIN_WIDTH = 240;
const CARD_GAP = 24;
const GRID_ROWS = 6;

export default function Home() {
    const [searchParams, setSearchParams] = useSearchParams();

    const urlLimit = searchParams.get('limit');
    const {
        containerRef,
        limit,
        isAutoLimit
    } = useGridLimit({
        minItemWidth: CARD_MIN_WIDTH,
        gap: CARD_GAP,
        rows: GRID_ROWS,
        override: urlLimit ? Number(urlLimit) : null
    });

    const page = Number(searchParams.get('page')) || 1;
    const sortBy = (searchParams.get('sortBy') as SortBy) || 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';
    const pinnedFirst = searchParams.get('pinnedFirst') === 'true';

    const {
        onDelete,
        onPinned
    } = useNoteMutate();

    const updateSearchParams = (updates: Record<string, string>) => {
        setSearchParams(params => {
            Object.entries(updates).forEach(([key, value]) => {
                params.set(key, value);
            });
            return params;
        });
    };

    return (
        <PageLayout title="" variant="none">
            <div ref={containerRef}>
                <NoteFilters
                    itemsPerPage={limit}
                    onItemsPerPageChange={(count) => updateSearchParams({
                        limit: count.toString(),
                        page: '1'
                    })}
                    isAutoLimit={isAutoLimit}
                    sortBy={sortBy}
                    onSortByChange={(sort) => updateSearchParams({
                        sortBy: sort,
                        page: '1'
                    })}
                    sortOrder={sortOrder}
                    onSortOrderChange={(order) => updateSearchParams({
                        sortOrder: order,
                        page: '1'
                    })}
                    pinnedFirst={pinnedFirst}
                    onPinnedFirstChange={(enabled) => updateSearchParams({
                        pinnedFirst: enabled.toString(),
                        page: '1'
                    })}
                />
                <Suspense
                    fallback={(
                        <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                            <Skeleton height="112px" />
                            <Skeleton height="112px" />
                            <Skeleton height="112px" />
                        </div>
                    )}>
                    <Notes
                        searchParams={{
                            offset: (page - 1) * limit,
                            limit,
                            sortBy,
                            sortOrder,
                            pinnedFirst
                        }}
                        render={({ notes, totalCount }) => (
                            <FallbackRender
                                fallback={(
                                    <Empty
                                        icon="🧠"
                                        title="Ocean is calm"
                                        description="Capture anything and make waves in the ocean!"
                                    />
                                )}>
                                {notes.length > 0 && (
                                <>
                                    <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                                        {notes.map(note => (
                                            <NoteListCard
                                                key={note.id}
                                                {...note}
                                                onPinned={() => onPinned(note.id, note.pinned)}
                                                onDelete={() => onDelete(note.id)}
                                            />
                                        ))}
                                    </div>
                                    <FallbackRender fallback={null}>
                                        {totalCount && limit < totalCount && (
                                            <Pagination
                                                page={page}
                                                last={Math.ceil(totalCount / limit)}
                                                onChange={(page) => {
                                                    updateSearchParams({ page: page.toString() });
                                                }}
                                            />
                                        )}
                                    </FallbackRender>
                                </>
                                )}
                            </FallbackRender>
                        )}
                    />
                </Suspense>
            </div>
        </PageLayout>
    );
}
