import { Link, getRouteApi } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import {
    Empty,
    FallbackRender,
    Highlight,
    PageLayout,
    Pagination,
    Skeleton
} from '~/components/shared';
import { Notes } from '~/components/entities';

import { NOTE_ROUTE, SEARCH_ROUTE } from '~/modules/url';

const Route = getRouteApi(SEARCH_ROUTE);

export default function Search() {
    const navigate = Route.useNavigate();
    const {
        page,
        query
    } = Route.useSearch();

    const limit = 10;

    return (
        <PageLayout title={`Search "${query}"`} variant="none">
            <main className="mx-auto max-w-[896px]">
                <QueryBoundary
                    fallback={(
                        <div className="flex flex-col gap-4">
                            <Skeleton height="64px" />
                            <Skeleton height="120px" />
                            <Skeleton height="120px" />
                        </div>
                    )}
                    errorTitle="Failed to load search results"
                    errorDescription={`Retry loading results for "${query}".`}
                    resetKeys={[query, page]}>
                    <Notes
                        searchParams={{
                            query,
                            limit,
                            offset: (page - 1) * limit,
                            fields: ['content']
                        }}
                        render={({ notes, totalCount }) => (
                            <>
                                <FallbackRender
                                    fallback={(
                                        <Empty
                                            title="No results found"
                                            description="Try searching for something else."
                                        />
                                    )}>
                                    {notes.length > 0 && notes.map((note) => (
                                        <div key={note.id} className="mb-5">
                                            <div className="text-heading mb-1 font-semibold">
                                                <Link
                                                    to={NOTE_ROUTE}
                                                    params={{ id: note.id }}>
                                                    <Highlight match={query}>
                                                        {note.title}
                                                    </Highlight>
                                                </Link>
                                            </div>
                                            <div className="bg-muted p-3 rounded-lg">
                                                {(JSON.parse(note.content) as object[]).filter(item => JSON.stringify(item).includes(query)).map((item) => (
                                                    <Highlight match={query}>
                                                        {JSON.stringify(item)}
                                                    </Highlight>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </FallbackRender>
                                <FallbackRender fallback={null}>
                                    {totalCount && limit < totalCount && (
                                        <Pagination
                                            page={page}
                                            last={Math.ceil(totalCount / limit)}
                                            onChange={(page) => {
                                                navigate({
                                                    search: prev => ({
                                                        ...prev,
                                                        page
                                                    })
                                                });
                                            }}
                                        />
                                    )}
                                </FallbackRender>
                            </>
                        )}
                    />
                </QueryBoundary>
            </main>
        </PageLayout>
    );
}
