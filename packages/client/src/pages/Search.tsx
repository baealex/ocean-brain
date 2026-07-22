import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import {
    type FetchSearchNotesParams,
    fetchSearchNotes,
    type SearchMode,
    type SearchNotesResult,
} from '~/apis/search.api';
import { QueryBoundary } from '~/components/app';
import { SearchInput, SearchMatchBadge, SearchModeControl } from '~/components/search';
import { Empty, Highlight, PageLayout, Pagination, Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';
import useSemanticSearchCapability from '~/hooks/useSemanticSearchCapability';
import { queryKeys } from '~/modules/query-key-factory';
import { getSearchPreviewBlocks } from '~/modules/search-preview';
import { NOTE_ROUTE, SEARCH_ROUTE } from '~/modules/url';

const Route = getRouteApi(SEARCH_ROUTE);
const SEARCH_PAGE_LIMIT = 10;

const formatResultCount = (count: number) => (count === 1 ? '1 result' : `${count} results`);

interface SearchNotesProps {
    searchParams: FetchSearchNotesParams;
    render: (data: SearchNotesResult) => React.ReactNode;
}

const SearchNotes = ({ searchParams, render }: SearchNotesProps) => {
    const { data } = useSuspenseQuery({
        queryKey: queryKeys.search.results(searchParams),
        async queryFn() {
            const response = await fetchSearchNotes(searchParams);
            if (response.type === 'error') {
                throw response;
            }
            return response.searchNotes;
        },
    });

    return render(data);
};

const SearchResultsSkeleton = () => (
    <main className="mt-5 flex flex-col gap-3" aria-label="Searching notes">
        {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="surface-base flex flex-col gap-3 p-4">
                <Skeleton width="34%" height={18} className="rounded-full" />
                <div className="rounded-[14px] bg-muted px-3 py-3">
                    <div className="flex flex-col gap-2">
                        <Skeleton width={84} height={12} className="rounded-full" />
                        <Skeleton width="100%" height={14} className="rounded-full" />
                        <Skeleton width="82%" height={14} className="rounded-full" />
                    </div>
                </div>
            </div>
        ))}
    </main>
);

const SearchAvailabilityNotice = ({ result, mode }: { result: SearchNotesResult; mode: SearchMode }) => {
    if (mode === 'lexical' || (result.semanticAvailable && !result.semanticError)) {
        return null;
    }

    return (
        <Text
            as="p"
            variant="meta"
            tone="tertiary"
            className="rounded-[14px] border border-border-subtle bg-muted px-3.5 py-2.5"
        >
            {mode === 'semantic'
                ? 'Meaning search is not ready. Configure an embedding API and build the index in Search settings.'
                : 'Meaning search is not ready, so these results use keyword search only.'}
        </Text>
    );
};

export default function Search() {
    const navigate = Route.useNavigate();
    const { page, query, mode } = Route.useSearch();
    const [draftQuery, setDraftQuery] = useState(query);
    const normalizedQuery = query.trim();
    const { isLoading: isCapabilityLoading, isSemanticSearchEnabled } = useSemanticSearchCapability();
    const activeMode: SearchMode = isSemanticSearchEnabled ? mode : 'lexical';

    useEffect(() => {
        setDraftQuery(query);
    }, [query]);

    const updateSearch = (nextQuery: string, nextMode: SearchMode = activeMode) => {
        navigate({
            search: {
                query: nextQuery.trim(),
                page: 1,
                mode: nextMode,
            },
        });
    };

    const handleModeChange = (nextMode: SearchMode) => {
        updateSearch(draftQuery, nextMode);
    };

    return (
        <PageLayout title="Search" description="Find exact words or describe a half-remembered note" variant="default">
            <main>
                <section aria-label="Search controls" className="surface-base p-3 sm:p-4">
                    <SearchInput
                        value={draftQuery}
                        onChange={setDraftQuery}
                        onSubmit={() => updateSearch(draftQuery)}
                        onClear={() => updateSearch('')}
                        autoFocus={!normalizedQuery}
                    />
                    {isSemanticSearchEnabled && (
                        <SearchModeControl value={activeMode} onChange={handleModeChange} className="mt-3" />
                    )}
                </section>

                {!normalizedQuery ? (
                    <div className="py-10">
                        <Empty
                            title="Throw a memory into the ocean"
                            description="Try a name, a rough date, a phrase, or simply describe what you remember."
                        />
                    </div>
                ) : isCapabilityLoading ? (
                    <SearchResultsSkeleton />
                ) : (
                    <QueryBoundary
                        fallback={<SearchResultsSkeleton />}
                        errorTitle="Failed to load search results"
                        errorDescription={`Retry loading results for "${normalizedQuery}".`}
                        resetKeys={[normalizedQuery, page, activeMode]}
                    >
                        <SearchNotes
                            searchParams={{
                                query: normalizedQuery,
                                limit: SEARCH_PAGE_LIMIT,
                                offset: (page - 1) * SEARCH_PAGE_LIMIT,
                                mode: activeMode,
                            }}
                            render={(result) => (
                                <div className="mt-5 flex flex-col gap-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <Text as="p" variant="meta" weight="semibold" tone="secondary">
                                            {formatResultCount(result.totalCount)} for "{normalizedQuery}"
                                        </Text>
                                    </div>

                                    <SearchAvailabilityNotice result={result} mode={activeMode} />

                                    {result.notes.length > 0 ? (
                                        <div className="flex flex-col gap-3">
                                            {result.notes.map((note) => {
                                                const previewBlocks = getSearchPreviewBlocks(
                                                    note.content,
                                                    normalizedQuery,
                                                );
                                                const match = result.matches.find((item) => item.noteId === note.id);

                                                return (
                                                    <article
                                                        key={note.id}
                                                        className="surface-base flex flex-col gap-3 p-4"
                                                    >
                                                        <div className="flex min-w-0 items-center justify-between gap-3">
                                                            <Text
                                                                as="h2"
                                                                variant="body"
                                                                weight="semibold"
                                                                tracking="tight"
                                                                className="min-w-0"
                                                            >
                                                                <Link
                                                                    to={NOTE_ROUTE}
                                                                    params={{ id: note.id }}
                                                                    className="transition-colors hover:text-fg-default/85"
                                                                >
                                                                    <Highlight match={normalizedQuery}>
                                                                        {note.title || 'Untitled'}
                                                                    </Highlight>
                                                                </Link>
                                                            </Text>
                                                            <SearchMatchBadge match={match} />
                                                        </div>
                                                        {previewBlocks.length > 0 ? (
                                                            <div className="rounded-[14px] bg-muted px-3 py-3">
                                                                <div className="flex flex-col gap-2">
                                                                    {previewBlocks.map((block, index) => (
                                                                        <div
                                                                            key={`${note.id}:${block.label}:${index}`}
                                                                            className={
                                                                                index > 0
                                                                                    ? 'border-t border-border-subtle pt-2'
                                                                                    : undefined
                                                                            }
                                                                        >
                                                                            <Text
                                                                                as="div"
                                                                                variant="micro"
                                                                                weight="semibold"
                                                                                tracking="wider"
                                                                                transform="uppercase"
                                                                                tone="tertiary"
                                                                            >
                                                                                {block.label}
                                                                            </Text>
                                                                            <Text
                                                                                as="p"
                                                                                variant="meta"
                                                                                tone="secondary"
                                                                                className="mt-1 leading-[1.65]"
                                                                            >
                                                                                <Highlight match={normalizedQuery}>
                                                                                    {block.text}
                                                                                </Highlight>
                                                                            </Text>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <Text
                                                                as="p"
                                                                variant="meta"
                                                                tone="secondary"
                                                                className="leading-[1.65]"
                                                            >
                                                                Open the note to inspect matching content.
                                                            </Text>
                                                        )}
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <Empty
                                            title="No results found"
                                            description={
                                                activeMode === 'semantic' && !result.semanticAvailable
                                                    ? 'Meaning search must be configured before it can find related notes.'
                                                    : 'Try another phrase or a different search method.'
                                            }
                                        />
                                    )}

                                    {result.totalCount > SEARCH_PAGE_LIMIT && (
                                        <Pagination
                                            page={page}
                                            last={Math.ceil(result.totalCount / SEARCH_PAGE_LIMIT)}
                                            onChange={(nextPage) => {
                                                navigate({
                                                    search: (prev) => ({
                                                        ...prev,
                                                        page: nextPage,
                                                        mode: activeMode,
                                                    }),
                                                });
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        />
                    </QueryBoundary>
                )}
            </main>
        </PageLayout>
    );
}
