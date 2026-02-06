import { Suspense } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';

import { Empty, FallbackRender, Pagination, Skeleton } from '~/components/shared';
import { Tags } from '~/components/entities';

import { getRandomBackground } from '~/modules/color';

export default function Tag() {
    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 60;
    const page = Number(searchParams.get('page')) || 1;

    return (
        <>
            <Helmet>
                <title>Tags | Ocean Brain</title>
            </Helmet>
            <Suspense
                fallback={(
                    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                        <Skeleton height="56px" />
                        <Skeleton height="56px" />
                        <Skeleton height="56px" />
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
                                    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                                        {tags.map((tag) => (
                                            <Link key={tag.id} to={`/tag/${tag.id}`} className="text-zinc-800 dark:text-zinc-200">
                                                <div className={`${getRandomBackground(tag.name)} p-4 relative rounded-[12px_4px_13px_3px/4px_10px_4px_12px] border-2 border-zinc-700 shadow-sketchy hover:shadow-sketchy-lg hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-200 font-bold`}>
                                                    {tag.name} ({tag.referenceCount})
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
        </>
    );
}
