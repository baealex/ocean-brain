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
                        <>
                            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                                {tags.map((tag) => (
                                    <Link key={tag.id} to={`/tag/${tag.id}`} className="text-zinc-700 dark:text-zinc-300">
                                        <div className={`${getRandomBackground(tag.name)} p-4 relative rounded-2xl`}>
                                            {tag.name} ({tag.referenceCount})
                                        </div>
                                    </Link>
                                ))}
                            </div>
                            <FallbackRender
                                fallback={(
                                    <Empty
                                        icon="🤔"
                                        title="There are no tags"
                                        description="Try to tag some notes using <@> key."
                                    />
                                )}>
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
                />
            </Suspense>
        </>
    );
}
