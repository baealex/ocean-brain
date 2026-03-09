import { getRouteApi } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import {
    Empty, FallbackRender, NoteFilters, PageLayout, Pagination, Skeleton
} from '~/components/shared';
import { NoteListCard } from '~/components/note';
import { Notes } from '~/components/entities';

import useNoteMutate from '~/hooks/resource/useNoteMutate';
import { useGridLimit } from '~/hooks/useGridLimit';
import type { HomeRouteSearch } from '~/modules/route-search';
import { HOME_ROUTE } from '~/modules/url';

const CARD_MIN_WIDTH = 240;
const CARD_GAP = 24;
const GRID_ROWS = 6;
const Route = getRouteApi(HOME_ROUTE);

export default function Home() {
    const navigate = Route.useNavigate();
    const {
        limit: urlLimit,
        page,
        sortBy,
        sortOrder,
        pinnedFirst
    } = Route.useSearch();
    const {
        containerRef,
        limit,
        isAutoLimit
    } = useGridLimit({
        minItemWidth: CARD_MIN_WIDTH,
        gap: CARD_GAP,
        rows: GRID_ROWS,
        override: urlLimit ?? null
    });

    const {
        onDelete,
        onPinned
    } = useNoteMutate();

    const updateSearchParams = (updates: Partial<HomeRouteSearch>) => {
        navigate({
            search: prev => ({
                ...prev,
                ...updates
            })
        });
    };

    return (
        <PageLayout title="" variant="none">
            <div ref={containerRef}>
                <NoteFilters
                    itemsPerPage={limit}
                    onItemsPerPageChange={(count) => updateSearchParams({
                        limit: count,
                        page: 1
                    })}
                    isAutoLimit={isAutoLimit}
                    sortBy={sortBy}
                    onSortByChange={(sort) => updateSearchParams({
                        sortBy: sort,
                        page: 1
                    })}
                    sortOrder={sortOrder}
                    onSortOrderChange={(order) => updateSearchParams({
                        sortOrder: order,
                        page: 1
                    })}
                    pinnedFirst={pinnedFirst}
                    onPinnedFirstChange={(enabled) => updateSearchParams({
                        pinnedFirst: enabled,
                        page: 1
                    })}
                />
                <QueryBoundary
                    fallback={(
                        <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                            <Skeleton height="112px" />
                            <Skeleton height="112px" />
                            <Skeleton height="112px" />
                        </div>
                    )}
                    errorTitle="Failed to load notes"
                    errorDescription="Retry loading the current note list."
                    resetKeys={[page, limit, sortBy, sortOrder, pinnedFirst]}>
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
                                                    updateSearchParams({ page });
                                                }}
                                            />
                                        )}
                                    </FallbackRender>
                                </>
                                )}
                            </FallbackRender>
                        )}
                    />
                </QueryBoundary>
            </div>
        </PageLayout>
    );
}
