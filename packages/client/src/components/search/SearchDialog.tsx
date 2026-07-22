import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { fetchSearchNotes, type SearchMode } from '~/apis/search.api';
import * as Icon from '~/components/icon';
import { Empty, Highlight, Skeleton } from '~/components/shared';
import { Dialog, DialogClose, DialogContent, DialogTitle, Text } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { getSearchPreviewBlocks } from '~/modules/search-preview';
import { NOTE_ROUTE, SEARCH_ROUTE } from '~/modules/url';

import SearchInput from './SearchInput';
import SearchMatchBadge from './SearchMatchBadge';
import SearchModeControl from './SearchModeControl';

interface SearchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const useDebouncedValue = <T,>(value: T, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedValue(value), delay);
        return () => window.clearTimeout(timer);
    }, [delay, value]);

    return debouncedValue;
};

const SearchDialogSkeleton = () => (
    <div className="flex flex-col gap-1.5 px-3 py-2" aria-label="Searching notes">
        {[0.4, 0.32, 0.24, 0.18].map((opacity) => (
            <div key={opacity} className="flex min-h-[70px] items-start gap-3 rounded-[12px] px-2.5 py-2.5">
                <Icon.FileNote className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary opacity-50" />
                <div className="min-w-0 flex-1">
                    <Skeleton width="42%" height={14} opacity={opacity} className="rounded-full" />
                    <Skeleton width="88%" height={12} opacity={opacity} className="mt-2 rounded-full" />
                </div>
            </div>
        ))}
    </div>
);

const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<SearchMode>('hybrid');
    const normalizedQuery = query.trim();
    const debouncedQuery = useDebouncedValue(normalizedQuery, 300);
    const searchParams = useMemo(
        () => ({
            query: debouncedQuery,
            limit: 8,
            offset: 0,
            mode,
        }),
        [debouncedQuery, mode],
    );
    const searchQuery = useQuery({
        queryKey: queryKeys.search.results(searchParams),
        enabled: open && debouncedQuery.length > 0,
        queryFn: async () => {
            const response = await fetchSearchNotes(searchParams);
            if (response.type === 'error') {
                throw response;
            }
            return response.searchNotes;
        },
    });
    const isWaitingForQuery = normalizedQuery !== debouncedQuery;
    const result = isWaitingForQuery ? undefined : searchQuery.data;

    const openFullSearch = () => {
        if (!normalizedQuery) return;

        onOpenChange(false);
        navigate({
            to: SEARCH_ROUTE,
            search: {
                query: normalizedQuery,
                page: 1,
                mode,
            },
        });
    };

    const showLoading = normalizedQuery.length > 0 && (isWaitingForQuery || searchQuery.isPending);
    const semanticUnavailable =
        result && mode !== 'lexical' && (!result.semanticAvailable || Boolean(result.semanticError));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="flex max-h-[min(760px,calc(100dvh-2rem))] max-w-[720px] flex-col overflow-hidden p-0"
            >
                <DialogTitle className="sr-only">Search notes</DialogTitle>
                <div className="border-b border-border-subtle/70 px-3 pb-3 pt-3 sm:px-4 sm:pt-4">
                    <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <SearchInput value={query} onChange={setQuery} onSubmit={openFullSearch} autoFocus />
                        </div>
                        <DialogClose asChild>
                            <button
                                type="button"
                                aria-label="Close search"
                                className="focus-ring-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            >
                                <Icon.Close className="h-5 w-5" weight="bold" />
                            </button>
                        </DialogClose>
                    </div>
                    <SearchModeControl value={mode} onChange={setMode} className="mt-3" />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1 sm:px-2">
                    {!normalizedQuery && (
                        <div className="px-3 py-8">
                            <Empty
                                title="Throw a memory into the ocean"
                                description="Names, fragments, dates, and rough descriptions all work."
                            />
                        </div>
                    )}
                    {showLoading && <SearchDialogSkeleton />}
                    {searchQuery.isError && !isWaitingForQuery && (
                        <div className="px-3 py-8">
                            <Empty title="Search failed" description="Try again in a moment." />
                        </div>
                    )}
                    {result && normalizedQuery && !searchQuery.isError && (
                        <>
                            {semanticUnavailable && (
                                <Text
                                    as="p"
                                    variant="meta"
                                    tone="tertiary"
                                    className="mx-3 my-2 rounded-[12px] border border-border-subtle bg-muted px-3 py-2"
                                >
                                    {mode === 'semantic'
                                        ? 'Meaning search is not ready. Configure and index it in Search settings.'
                                        : 'Meaning search is not ready, so these results use keywords only.'}
                                </Text>
                            )}
                            {result.notes.length > 0 ? (
                                <div className="flex flex-col py-1">
                                    {result.notes.map((note) => {
                                        const preview = getSearchPreviewBlocks(note.content, normalizedQuery)[0];
                                        const match = result.matches.find((item) => item.noteId === note.id);

                                        return (
                                            <Link
                                                key={note.id}
                                                to={NOTE_ROUTE}
                                                params={{ id: note.id }}
                                                onClick={() => onOpenChange(false)}
                                                className="focus-ring-soft mx-1 flex min-h-[72px] items-start gap-3 rounded-[13px] px-3 py-3 outline-none transition-colors hover:bg-hover-subtle"
                                            >
                                                <Icon.FileNote className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex min-w-0 items-center justify-between gap-2">
                                                        <Text
                                                            as="span"
                                                            truncate
                                                            variant="meta"
                                                            weight="semibold"
                                                            className="min-w-0 text-fg-default"
                                                        >
                                                            <Highlight match={normalizedQuery}>
                                                                {note.title || 'Untitled'}
                                                            </Highlight>
                                                        </Text>
                                                        <SearchMatchBadge match={match} />
                                                    </div>
                                                    <Text
                                                        as="p"
                                                        variant="meta"
                                                        tone="tertiary"
                                                        className="mt-1 line-clamp-2 leading-relaxed"
                                                    >
                                                        {preview?.text ?? 'Open the note to inspect matching content.'}
                                                    </Text>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="px-3 py-8">
                                    <Empty
                                        title="No results found"
                                        description={
                                            mode === 'semantic' && semanticUnavailable
                                                ? 'Meaning search must be configured before it can find related notes.'
                                                : 'Try another phrase or a different search method.'
                                        }
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {normalizedQuery && (
                    <div className="border-t border-border-subtle/70 p-2.5 sm:px-4 sm:py-3">
                        <button
                            type="button"
                            className="focus-ring-soft flex min-h-10 w-full items-center justify-between rounded-[12px] px-2.5 text-left text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            onClick={openFullSearch}
                        >
                            <Text as="span" variant="meta" weight="semibold" className="text-current">
                                View all results
                                {result ? ` (${result.totalCount})` : ''}
                            </Text>
                            <Icon.ChevronRight className="h-4 w-4" weight="bold" />
                        </button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default SearchDialog;
