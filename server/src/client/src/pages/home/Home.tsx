import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import {
    Empty, FallbackRender, NoteFilters, Pagination, Skeleton
} from '~/shared/ui';
import { NoteListCard, NoteListTable } from '~/entities/note/ui';
import { useNotes } from '~/entities/note';

import useNoteMutate from '~/shared/hooks/resource/useNoteMutate';

import type { ViewMode, SortBy, SortOrder } from '~/shared/ui/NoteFilters';

export default function Home() {
    const [searchParams, setSearchParams] = useSearchParams();

    const viewMode = (searchParams.get('view') as ViewMode) || 'grid';
    const limit = Number(searchParams.get('limit')) || 25;
    const page = Number(searchParams.get('page')) || 1;
    const sortBy = (searchParams.get('sortBy') as SortBy) || 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';
    const pinnedFirst = searchParams.get('pinnedFirst') === 'true';

    const { data } = useNotes({
        offset: (page - 1) * limit,
        limit,
        sortBy,
        sortOrder,
        pinnedFirst
    });

    const { notes = [], totalCount = 0 } = data || {};

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
        <>
            <Helmet>
                <title>Ocean Brain</title>
            </Helmet>
            <NoteFilters
                viewMode={viewMode}
                onViewModeChange={(mode) => updateSearchParams({
                    view: mode,
                    page: '1'
                })}
                itemsPerPage={limit}
                onItemsPerPageChange={(count) => updateSearchParams({
                    limit: count.toString(),
                    page: '1'
                })}
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
                            {viewMode === 'grid' ? (
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
                            ) : (
                                <NoteListTable
                                    notes={notes}
                                    onPinned={onPinned}
                                    onDelete={onDelete}
                                />
                            )}
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
            </Suspense>
        </>
    );
}
