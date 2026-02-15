import { Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
    Empty,
    FallbackRender,
    PageLayout,
    Pagination,
    Skeleton
} from '~/components/shared';
import { Tags } from '~/components/entities';
import { useGridLimit } from '~/hooks/useGridLimit';

const TAG_MIN_WIDTH = 100;
const TAG_GAP = 8;
const TAG_ROWS = 12;

export default function Tag() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { containerRef, limit } = useGridLimit({
        minItemWidth: TAG_MIN_WIDTH,
        gap: TAG_GAP,
        rows: TAG_ROWS
    });

    const page = Number(searchParams.get('page')) || 1;

    return (
        <PageLayout title="Tags" description="Organize and browse notes by tags">
            <div ref={containerRef}>
                <Suspense
                    fallback={(
                        <div className="flex flex-wrap gap-2">
                            <Skeleton width="90px" height="36px" />
                            <Skeleton width="120px" height="36px" />
                            <Skeleton width="80px" height="36px" />
                            <Skeleton width="100px" height="36px" />
                            <Skeleton width="110px" height="36px" />
                            <Skeleton width="70px" height="36px" />
                        </div>
                    )}>
                    <Tags
                        searchParams={{
                            offset: (page - 1) * limit,
                            limit
                        }}
                        render={({ tags, totalCount }) => (
                            <FallbackRender
                                fallback={(
                                    <Empty
                                        icon="🤔"
                                        title="There are no tags"
                                        description="Try to tag some notes using <@> key."
                                    />
                                )}>
                                {tags.length > 0 && (
                                    <>
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map((tag) => (
                                                <Link key={tag.id} to={`/tag/${tag.id}`}>
                                                    <div className="bg-pastel-teal-200 dark:bg-muted px-3 py-1.5 rounded-[8px_3px_9px_2px/3px_6px_3px_7px] border-2 border-border shadow-sketchy hover:shadow-sketchy-lg hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-200 font-bold text-sm text-fg-default whitespace-nowrap">
                                                        {tag.name} <span className="text-fg-tertiary text-xs">({tag.referenceCount})</span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                        <FallbackRender
                                            fallback={null}>
                                            {totalCount && limit < totalCount && (
                                                <Pagination
                                                    page={page}
                                                    last={Math.ceil(totalCount / limit)}
                                                    onChange={(page) => {
                                                        setSearchParams(searchParams => {
                                                            searchParams.set('page', page.toString());
                                                            return searchParams;
                                                        });
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
