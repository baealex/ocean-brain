import { Link, useNavigate } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { fetchSearchNotes, type SearchMode, type SearchNote } from '~/apis/search.api';
import * as Icon from '~/components/icon';
import { Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';
import useDebounce from '~/hooks/useDebounce';
import { NOTE_ROUTE, SEARCH_ROUTE } from '~/modules/url';

const formClassName = 'flex flex-col gap-2.5';
const searchSurfaceClassName =
    'overflow-hidden rounded-[14px] border border-border-subtle bg-elevated transition-colors focus-within:border-border-focus focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-soft-primary)_90%,transparent)]';
const searchRowClassName =
    'grid-search-bar grid items-center border-b border-transparent px-2.5 py-1.5 transition-colors';
const searchRowWithResultsClassName = 'border-border-subtle/70';
const iconButtonClassName =
    'flex h-10 items-center justify-center text-fg-tertiary transition-colors hover:text-fg-default sm:h-8';
const searchInputClassName =
    'h-10 w-full bg-transparent py-2 text-meta text-fg-default outline-none placeholder:text-fg-placeholder sm:h-8 sm:py-1.5';
const resultsPanelClassName = 'max-h-[min(48vh,320px)] overflow-y-auto px-1 py-1.5';
const resultRowClassName =
    'focus-ring-soft flex min-h-10 items-center gap-2 rounded-[10px] px-2.5 py-2 outline-none transition-colors hover:bg-hover-subtle sm:min-h-0 sm:px-2 sm:py-1.5';
const footerWrapClassName = 'mt-1 border-t border-border-subtle/50 px-2 pb-0.5 pt-1.5';
const footerActionClassName =
    'focus-ring-soft flex min-h-9 items-center gap-1.5 rounded-[10px] text-fg-secondary outline-none transition-colors hover:text-fg-default';
const SIDEBAR_SEARCH_DEBOUNCE_MS = 400;

interface SidebarSearchResults {
    notes: SearchNote[];
}

interface LegacySidebarQuickSearchProps {
    fullSearchMode?: SearchMode;
    meaningSearchEnabled?: boolean;
}

const LegacySidebarQuickSearch = ({
    fullSearchMode = 'lexical',
    meaningSearchEnabled = false,
}: LegacySidebarQuickSearchProps) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SidebarSearchResults | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearchError, setHasSearchError] = useState(false);
    const requestIdRef = useRef(0);
    const [, setEvent] = useDebounce(SIDEBAR_SEARCH_DEBOUNCE_MS);

    useEffect(() => {
        const nextQuery = query.trim();

        if (!nextQuery) {
            requestIdRef.current += 1;
            setEvent(() => undefined);
            setSearchResults(null);
            setIsSearching(false);
            setHasSearchError(false);
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setSearchResults(null);
        setIsSearching(true);
        setHasSearchError(false);

        setEvent(() => {
            fetchSearchNotes({
                query: nextQuery,
                limit: 5,
                mode: fullSearchMode,
            }).then(
                (response) => {
                    if (requestIdRef.current !== requestId) return;

                    if (response.type === 'success') {
                        setSearchResults({
                            notes: response.searchNotes.notes,
                        });
                    } else {
                        setSearchResults({ notes: [] });
                        setHasSearchError(true);
                    }
                    setIsSearching(false);
                },
                () => {
                    if (requestIdRef.current !== requestId) return;

                    setSearchResults({ notes: [] });
                    setIsSearching(false);
                    setHasSearchError(true);
                },
            );
        });
    }, [fullSearchMode, query, setEvent]);

    const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        const nextQuery = query.trim();
        if (!nextQuery) return;

        navigate({
            to: SEARCH_ROUTE,
            search: {
                query: nextQuery,
                page: 1,
                mode: fullSearchMode,
            },
        });
    };

    const hasQuery = query.trim().length > 0;
    const hasResults = (searchResults?.notes.length ?? 0) > 0;
    const showNoQuickMatches = hasQuery && !isSearching && searchResults !== null && !hasResults;

    return (
        <form className={formClassName} onSubmit={handleSubmit}>
            <div className={searchSurfaceClassName}>
                <div className={`${searchRowClassName} ${hasResults ? searchRowWithResultsClassName : ''}`}>
                    <button type="submit" aria-label="Search notes" className={iconButtonClassName}>
                        <Icon.Search className="h-4.5 w-4.5" weight="bold" />
                    </button>
                    <input
                        type="text"
                        aria-label="Quick search notes"
                        placeholder={meaningSearchEnabled ? 'Search or describe a memory' : 'Search notes'}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className={searchInputClassName}
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            className={iconButtonClassName}
                            onClick={() => setQuery('')}
                        >
                            <Icon.Close className="h-4 w-4" weight="bold" />
                        </button>
                    )}
                </div>
                {hasQuery && (
                    <div className={resultsPanelClassName}>
                        {isSearching && (
                            <div>
                                {[0.34, 0.3, 0.26, 0.22, 0.18].map((opacity) => (
                                    <div key={opacity} className={resultRowClassName} aria-hidden="true">
                                        <Icon.FileNote className="h-3.5 w-3.5 shrink-0 text-fg-tertiary opacity-50" />
                                        <Skeleton height="21px" opacity={opacity} className="min-w-0 flex-1" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {showNoQuickMatches && (
                            <Text as="div" variant="meta" tone="secondary" className="px-2 py-2">
                                {hasSearchError
                                    ? 'Search could not refresh. Try again.'
                                    : meaningSearchEnabled
                                      ? 'No matching notes. Try another way to describe it.'
                                      : 'No quick matches.'}
                            </Text>
                        )}
                        {searchResults && hasResults && (
                            <div>
                                {searchResults.notes.map(({ id, title }) => (
                                    <Link key={id} to={NOTE_ROUTE} params={{ id }} className={resultRowClassName}>
                                        <Icon.FileNote className="h-3.5 w-3.5 shrink-0 text-fg-tertiary" />
                                        <Text
                                            as="span"
                                            truncate
                                            variant="meta"
                                            weight="medium"
                                            className="min-w-0 flex-1"
                                        >
                                            {title || 'Untitled'}
                                        </Text>
                                    </Link>
                                ))}
                            </div>
                        )}
                        <div className={footerWrapClassName}>
                            <button type="submit" className={footerActionClassName}>
                                <Text as="span" variant="meta" weight="medium" className="text-current">
                                    {meaningSearchEnabled ? 'Search all notes' : 'View all results'}
                                </Text>
                                <Icon.ChevronRight className="h-3.5 w-3.5" weight="bold" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </form>
    );
};

export default LegacySidebarQuickSearch;
