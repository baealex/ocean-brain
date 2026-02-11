import { Suspense, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import {
    Empty, FallbackRender, NoteFilters, Pagination, Skeleton
} from '~/components/shared';
import { NoteListCard } from '~/components/note';
import { Notes } from '~/components/entities';

import useNoteMutate from '~/hooks/resource/useNoteMutate';

import type { SortBy, SortOrder } from '~/components/shared/NoteFilters';

const CARD_MIN_WIDTH = 240;
const CARD_GAP = 24;
const GRID_ROWS = 6;

function calculateAutoLimit(containerWidth: number): number {
    const cardsPerRow = Math.floor((containerWidth + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP));
    return Math.max(cardsPerRow * GRID_ROWS, 8);
}

export default function Home() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [autoLimit, setAutoLimit] = useState<number | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();

    const urlLimit = searchParams.get('limit');
    const limit = urlLimit ? Number(urlLimit) : (autoLimit ?? 12);
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

    useLayoutEffect(() => {
        if (urlLimit) return;
        if (!containerRef.current) return;

        const containerWidth = containerRef.current.offsetWidth;
        const calculatedLimit = calculateAutoLimit(containerWidth);
        setAutoLimit(calculatedLimit);
    }, [urlLimit]);

    return (
        <div ref={containerRef}>
            <Helmet>
                <title>Ocean Brain</title>
            </Helmet>
            <NoteFilters
                itemsPerPage={limit}
                onItemsPerPageChange={(count) => updateSearchParams({
                    limit: count.toString(),
                    page: '1'
                })}
                isAutoLimit={!urlLimit}
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
    );
}
