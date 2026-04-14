import { getRouteApi, Link } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import { Tags } from '~/components/entities';
import { Empty, FallbackRender, PageLayout, Pagination, Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';
import { useGridLimit } from '~/hooks/useGridLimit';
import { TAG_NOTES_ROUTE, TAG_ROUTE } from '~/modules/url';

const TAG_MIN_WIDTH = 100;
const TAG_GAP = 8;
const TAG_ROWS = 12;
const Route = getRouteApi(TAG_ROUTE);

export default function Tag() {
    const navigate = Route.useNavigate();
    const { page } = Route.useSearch();
    const { containerRef, limit } = useGridLimit({
        minItemWidth: TAG_MIN_WIDTH,
        gap: TAG_GAP,
        rows: TAG_ROWS,
    });

    return (
        <div ref={containerRef}>
            <QueryBoundary
                fallback={
                    <PageLayout
                        title="Tags"
                        heading={<Skeleton width={120} height={24} className="rounded-full" />}
                        description={<Skeleton width={188} height={16} className="rounded-full" />}
                    >
                        <div className="flex flex-wrap gap-2.5">
                            <Skeleton width="90px" height="36px" />
                            <Skeleton width="120px" height="36px" />
                            <Skeleton width="80px" height="36px" />
                            <Skeleton width="100px" height="36px" />
                            <Skeleton width="110px" height="36px" />
                            <Skeleton width="70px" height="36px" />
                        </div>
                    </PageLayout>
                }
                errorTitle="Failed to load tags"
                errorDescription="Retry loading the tag catalog"
                resetKeys={[page, limit]}
            >
                <Tags
                    searchParams={{
                        offset: (page - 1) * limit,
                        limit,
                    }}
                    render={({ tags, totalCount }) => (
                        <PageLayout
                            title="Tags"
                            heading={totalCount > 0 ? `Tags (${totalCount})` : undefined}
                            description="Browse the tags you added with @ across your notes"
                        >
                            <FallbackRender
                                fallback={
                                    <Empty
                                        title="No tags yet"
                                        description="Add @tags inside notes and they will appear here"
                                    />
                                }
                            >
                                {tags.length > 0 && (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-wrap gap-2.5">
                                            {tags.map((tag) => (
                                                <Link
                                                    key={tag.id}
                                                    to={TAG_NOTES_ROUTE}
                                                    params={{ id: tag.id }}
                                                    search={{ page: 1 }}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-hover-subtle px-3 py-1.5 text-fg-secondary transition-colors hover:border-border-secondary hover:bg-hover hover:text-fg-default"
                                                >
                                                    <Text
                                                        as="span"
                                                        variant="meta"
                                                        weight="medium"
                                                        className="text-current"
                                                    >
                                                        {tag.name}
                                                    </Text>
                                                    <Text
                                                        as="span"
                                                        variant="label"
                                                        weight="medium"
                                                        tone="tertiary"
                                                        className="text-current/70"
                                                    >
                                                        {tag.referenceCount}
                                                    </Text>
                                                </Link>
                                            ))}
                                        </div>
                                        <FallbackRender fallback={null}>
                                            {totalCount && limit < totalCount && (
                                                <Pagination
                                                    page={page}
                                                    last={Math.ceil(totalCount / limit)}
                                                    onChange={(page) => {
                                                        navigate({
                                                            search: (prev) => ({
                                                                ...prev,
                                                                page,
                                                            }),
                                                        });
                                                    }}
                                                />
                                            )}
                                        </FallbackRender>
                                    </div>
                                )}
                            </FallbackRender>
                        </PageLayout>
                    )}
                />
            </QueryBoundary>
        </div>
    );
}
