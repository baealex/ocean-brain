import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
    type FetchSearchNotesParams,
    fetchSearchNotes,
    fetchSearchRelatedNotes,
    type SearchMode,
    type SearchNote,
    type SearchNotesResult,
} from '~/apis/search.api';
import { QueryBoundary } from '~/components/app';
import * as Icon from '~/components/icon';
import { SearchInput, SearchMatchBadge } from '~/components/search';
import { AuxiliaryPanelHeader, Empty, Highlight, PageLayout, Pagination, Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';
import { ViewChip } from '~/components/view';
import useSemanticSearchCapability from '~/hooks/useSemanticSearchCapability';
import { queryKeys } from '~/modules/query-key-factory';
import { getSearchPreviewBlocks, type SearchPreviewKind } from '~/modules/search-preview';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE, SEARCH_ROUTE, SETTINGS_SEARCH_ROUTE, TAG_NOTES_ROUTE } from '~/modules/url';

const Route = getRouteApi(SEARCH_ROUTE);
const SEARCH_PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_RESULT_STALE_TIME_MS = 30_000;

const formatResultCount = (count: number) => (count === 1 ? '1 result' : `${count} results`);

const formatUpdatedAt = (updatedAt: string) => {
    const numericTimestamp = Number(updatedAt);
    const timestamp = Number.isFinite(numericTimestamp) ? numericTimestamp : Date.parse(updatedAt);

    return Number.isFinite(timestamp) ? `Updated ${timeSince(timestamp)}` : 'Updated recently';
};

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
        staleTime: SEARCH_RESULT_STALE_TIME_MS,
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

const SearchNoteMeta = ({ note }: { note: SearchNote }) => {
    const visibleTags = note.tags.slice(0, 2);
    const hiddenTagCount = note.tags.length - visibleTags.length;

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 sm:col-start-1 sm:row-start-2">
            {note.pinned && (
                <span className="inline-flex items-center text-fg-tertiary" title="Pinned note">
                    <Icon.Pin className="h-3.5 w-3.5" weight="fill" aria-hidden="true" />
                    <span className="sr-only">Pinned note</span>
                </span>
            )}
            <Text as="span" variant="label" weight="medium" tone="tertiary">
                {formatUpdatedAt(note.updatedAt)}
            </Text>
            {visibleTags.map((tag) => (
                <Link key={tag.id} to={TAG_NOTES_ROUTE} params={{ id: tag.id }} search={{ page: 1 }}>
                    <ViewChip
                        size="compact"
                        className="border-border-subtle bg-transparent text-fg-secondary transition-colors hover:bg-hover-subtle hover:text-fg-default"
                    >
                        {tag.name}
                    </ViewChip>
                </Link>
            ))}
            {hiddenTagCount > 0 && (
                <ViewChip size="compact" className="border-border-subtle bg-subtle text-fg-tertiary">
                    +{hiddenTagCount}
                </ViewChip>
            )}
        </div>
    );
};

const getSearchPreviewMarker = (kind: SearchPreviewKind) => {
    if (kind === 'list') return '•';
    if (kind === 'checklist') return '☐';
    return null;
};

const getSearchPreviewBlockClassName = (kind: SearchPreviewKind) => {
    if (kind === 'quote') {
        return 'border-l-2 border-border-secondary pl-3 italic';
    }

    if (kind === 'code') {
        return 'rounded-[10px] bg-subtle/70 px-2.5 py-2 font-mono text-sm';
    }

    return undefined;
};

const SearchPreview = ({
    blocks,
    query,
}: {
    blocks: Array<{ kind: SearchPreviewKind; text: string }>;
    query: string;
}) => {
    return (
        <div className="rounded-[14px] border border-border-subtle/80 bg-muted/40 px-3.5 py-3">
            {blocks.map((block, index) => {
                const marker = getSearchPreviewMarker(block.kind);

                return (
                    <div
                        key={`${block.kind}:${index}`}
                        className={index > 0 ? 'mt-2 border-t border-border-subtle/70 pt-2' : undefined}
                    >
                        <div className="flex items-start gap-2">
                            {marker && (
                                <span className="mt-0.5 w-4 shrink-0 text-center text-fg-tertiary" aria-hidden="true">
                                    {marker}
                                </span>
                            )}
                            <Text
                                as="p"
                                variant="body"
                                weight={block.kind === 'heading' ? 'semibold' : 'regular'}
                                tone={block.kind === 'heading' ? 'default' : 'secondary'}
                                className={getSearchPreviewBlockClassName(block.kind) ?? 'leading-[1.65]'}
                            >
                                <Highlight match={query}>{block.text}</Highlight>
                            </Text>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const RelatedNotes = ({ noteId }: { noteId: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { data, isError, isLoading } = useQuery({
        queryKey: queryKeys.search.related(noteId),
        queryFn: async () => {
            const response = await fetchSearchRelatedNotes(noteId);
            if (response.type === 'error') {
                throw response;
            }

            return response.searchRelatedNotes;
        },
        enabled: isOpen,
        staleTime: SEARCH_RESULT_STALE_TIME_MS,
    });

    return (
        <details
            className="group border-t border-border-subtle/70 pt-3"
            onToggle={(event) => setIsOpen(event.currentTarget.open)}
        >
            <summary className="focus-ring-soft flex cursor-pointer list-none items-center justify-between gap-3 rounded-[10px] border border-transparent px-2.5 py-1.5 outline-none transition-colors hover:bg-hover-subtle marker:hidden">
                <span className="flex min-w-0 items-center gap-2">
                    <AuxiliaryPanelHeader
                        icon={<Icon.LinkSimple className="h-3.5 w-3.5" />}
                        title="Related notes"
                        className="text-fg-tertiary"
                    />
                    {data && (
                        <Text as="span" variant="meta" weight="medium" tone="tertiary">
                            {data.length}
                        </Text>
                    )}
                </span>
                <Icon.ChevronDown
                    className="h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-open:rotate-180"
                    aria-hidden="true"
                />
            </summary>
            <div className="mt-2">
                {isLoading && (
                    <Text as="p" variant="meta" tone="tertiary" className="px-2 py-1.5">
                        Looking for related notes…
                    </Text>
                )}
                {isError && (
                    <Text as="p" variant="meta" tone="error" className="px-2 py-1.5">
                        Related notes could not be loaded.
                    </Text>
                )}
                {!isLoading && !isError && data?.length === 0 && (
                    <Text as="p" variant="meta" tone="tertiary" className="px-2 py-1.5">
                        No direct connections found yet.
                    </Text>
                )}
                {!isLoading && !isError && data && data.length > 0 && (
                    <ul className="flex flex-col">
                        {data.map((relatedNote) => (
                            <li key={relatedNote.id}>
                                <Link
                                    to={NOTE_ROUTE}
                                    params={{ id: relatedNote.id }}
                                    className="flex min-w-0 items-start gap-2 rounded-[10px] px-2.5 py-1.5 text-fg-secondary transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                >
                                    <Icon.File
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-tertiary"
                                        aria-hidden="true"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <Text
                                            as="span"
                                            variant="body"
                                            weight="medium"
                                            className="text-current line-clamp-1"
                                        >
                                            {relatedNote.title || 'Untitled'}
                                        </Text>
                                        <Text
                                            as="span"
                                            variant="meta"
                                            tone="tertiary"
                                            className="mt-0.5 block line-clamp-1"
                                        >
                                            {relatedNote.reasons.join(' · ')}
                                        </Text>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </details>
    );
};

const SearchAvailabilityNotice = ({ result, mode }: { result: SearchNotesResult; mode: SearchMode }) => {
    if (mode === 'lexical' || (result.semanticAvailable && !result.semanticError)) {
        return null;
    }

    return (
        <Text
            as="p"
            variant="body"
            tone="tertiary"
            className="rounded-[14px] border border-border-subtle bg-muted px-3.5 py-2.5"
        >
            {mode === 'semantic'
                ? 'Meaning search is not ready. Configure an embedding API and build the index in Search settings.'
                : 'Meaning search is not ready, so these results use keyword search only.'}
        </Text>
    );
};

const SearchDiscoveryHint = ({ isVisible }: { isVisible: boolean }) => {
    if (!isVisible) {
        return null;
    }

    return (
        <Text as="p" variant="meta" tone="tertiary" className="mx-auto mt-5 max-w-[34rem] text-center">
            <span className="font-semibold text-fg-secondary">Tip:</span> Search by meaning when the exact words are
            fuzzy.{' '}
            <Link
                to={SETTINGS_SEARCH_ROUTE}
                className="font-semibold text-fg-secondary underline decoration-border-secondary underline-offset-2 transition-colors hover:text-fg-default"
            >
                Enable meaning search
            </Link>
        </Text>
    );
};

export default function Search() {
    const navigate = Route.useNavigate();
    const { page, query, mode } = Route.useSearch();
    const [draftQuery, setDraftQuery] = useState(query);
    const [isComposing, setIsComposing] = useState(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const normalizedQuery = query.trim();
    const {
        isLoading: isCapabilityLoading,
        isError: isCapabilityError,
        isSemanticSearchEnabled,
        isSemanticSearchAvailable,
    } = useSemanticSearchCapability();
    const activeMode: SearchMode = isCapabilityLoading || isSemanticSearchAvailable ? mode : 'lexical';
    const searchDescription = isSemanticSearchAvailable
        ? 'Use exact words or describe a half-remembered note'
        : 'Search notes by exact words';

    useEffect(() => {
        setDraftQuery(query);
    }, [query]);

    const clearPendingSearch = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
    }, []);

    const updateSearch = useCallback(
        (nextQuery: string, nextMode: SearchMode = activeMode, replace = false) => {
            const search = {
                query: nextQuery.trim(),
                page: 1,
                mode: nextMode,
            };

            if (replace) {
                navigate({ search, replace: true });
                return;
            }

            navigate({ search });
        },
        [activeMode, navigate],
    );

    useEffect(() => {
        clearPendingSearch();
        if (isComposing || draftQuery.trim() === normalizedQuery) {
            return;
        }

        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            updateSearch(draftQuery, activeMode, true);
        }, SEARCH_DEBOUNCE_MS);

        return clearPendingSearch;
    }, [activeMode, clearPendingSearch, draftQuery, isComposing, normalizedQuery, updateSearch]);

    const handleSubmit = () => {
        if (isComposing) {
            return;
        }

        clearPendingSearch();
        updateSearch(draftQuery);
    };

    const handleModeChange = (nextMode: SearchMode) => {
        clearPendingSearch();
        updateSearch(draftQuery, nextMode);
    };

    return (
        <PageLayout title="Search" description={searchDescription} variant="default">
            <main>
                <section aria-label="Search controls" className="border-b border-border-subtle pb-5">
                    <SearchInput
                        value={draftQuery}
                        onChange={setDraftQuery}
                        onCompositionChange={setIsComposing}
                        mode={isSemanticSearchAvailable ? activeMode : undefined}
                        onModeChange={isSemanticSearchAvailable ? handleModeChange : undefined}
                        placeholder={
                            isSemanticSearchAvailable ? 'Search or describe a memory' : 'Search notes by keyword'
                        }
                        onSubmit={handleSubmit}
                        onClear={() => {
                            clearPendingSearch();
                            updateSearch('');
                        }}
                        autoFocus={!normalizedQuery}
                    />
                </section>

                {!normalizedQuery ? (
                    <div className="py-10">
                        <Empty
                            title="Start with anything you remember"
                            description="A name, phrase, rough date, or description all work."
                        />
                        <SearchDiscoveryHint
                            isVisible={!isCapabilityLoading && !isCapabilityError && !isSemanticSearchEnabled}
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
                                <div className="mt-5 flex flex-col gap-3">
                                    <div className="flex min-h-7 items-center justify-between gap-3">
                                        <Text as="p" variant="body" weight="semibold" tone="secondary">
                                            {formatResultCount(result.totalCount)}
                                        </Text>
                                    </div>

                                    <SearchAvailabilityNotice result={result} mode={activeMode} />

                                    {result.notes.length > 0 ? (
                                        <div className="grid gap-3">
                                            {result.notes.map((note) => {
                                                const previewBlocks = getSearchPreviewBlocks(
                                                    note.content,
                                                    normalizedQuery,
                                                );
                                                const match = result.matches.find((item) => item.noteId === note.id);

                                                return (
                                                    <article
                                                        key={note.id}
                                                        className="surface-base flex flex-col gap-3.5 rounded-[16px] p-4 transition-colors hover:border-border-secondary/70 hover:bg-hover-subtle/25 sm:p-5"
                                                    >
                                                        <div className="grid min-w-0 gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
                                                                    className="line-clamp-2 transition-colors hover:text-fg-default/85"
                                                                >
                                                                    <Highlight match={normalizedQuery}>
                                                                        {note.title || 'Untitled'}
                                                                    </Highlight>
                                                                </Link>
                                                            </Text>
                                                            <SearchNoteMeta note={note} />
                                                            <SearchMatchBadge
                                                                match={match}
                                                                className="justify-self-start sm:col-start-2 sm:row-start-1 sm:justify-self-end"
                                                            />
                                                        </div>
                                                        {previewBlocks.length > 0 ? (
                                                            <SearchPreview
                                                                blocks={previewBlocks}
                                                                query={normalizedQuery}
                                                            />
                                                        ) : (
                                                            <div className="rounded-[14px] border border-dashed border-border-subtle/80 bg-muted/25 px-3.5 py-3">
                                                                <Text
                                                                    as="p"
                                                                    variant="body"
                                                                    tone="tertiary"
                                                                    className="leading-[1.65]"
                                                                >
                                                                    Open the note to inspect matching content.
                                                                </Text>
                                                            </div>
                                                        )}
                                                        <RelatedNotes noteId={note.id} />
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
