import { Link, useNavigate } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { fetchNotes } from '~/apis/note.api';
import * as Icon from '~/components/icon';
import { Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';
import useDebounce from '~/hooks/useDebounce';
import type { Note } from '~/models/note.model';
import { NOTE_ROUTE, SEARCH_ROUTE } from '~/modules/url';

const formClassName = 'flex flex-col gap-2.5';
const searchSurfaceClassName =
    'overflow-hidden rounded-[14px] border border-border-subtle bg-elevated transition-colors focus-within:border-border-focus focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--border-focus)_90%,transparent)]';
const searchRowClassName =
    'grid-search-bar grid items-center border-b border-transparent px-2.5 py-1.5 transition-colors';
const searchRowWithResultsClassName = 'border-border-subtle/70';
const searchRowIdleClassName = '';
const iconButtonClassName =
    'flex h-10 items-center justify-center text-fg-tertiary transition-colors hover:text-fg-default sm:h-8';
const searchInputClassName =
    'h-10 w-full bg-transparent py-2 text-meta text-fg-default outline-none placeholder:text-fg-placeholder sm:h-8 sm:py-1.5';
const resultsPanelClassName = 'max-h-[min(48vh,320px)] overflow-y-auto px-1 py-1.5';
const resultRowClassName =
    'focus-ring-soft flex min-h-10 items-center gap-2 rounded-[10px] px-2.5 py-2 outline-none transition-colors hover:bg-hover-subtle sm:min-h-0 sm:px-2 sm:py-1.5';
const resultTitleClassName = 'min-w-0 flex-1';
const footerWrapClassName = 'mt-1 border-t border-border-subtle/50 px-2 pb-0.5 pt-1.5';
const footerActionClassName =
    'focus-ring-soft flex min-h-9 items-center gap-1.5 rounded-[10px] text-fg-secondary outline-none transition-colors hover:text-fg-default';

const SidebarSearch = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [notes, setNotes] = useState<Note[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const requestIdRef = useRef(0);
    const [, setEvent] = useDebounce(500);

    useEffect(() => {
        const nextQuery = query.trim();

        if (nextQuery.length <= 0) {
            requestIdRef.current += 1;
            setEvent(() => undefined);
            setNotes([]);
            setIsSearching(false);
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setNotes([]);
        setIsSearching(true);

        setEvent(() => {
            fetchNotes({
                query: nextQuery,
                limit: 5,
            }).then(
                (notesResponse) => {
                    if (requestIdRef.current !== requestId) {
                        return;
                    }

                    setNotes(notesResponse.type === 'success' ? notesResponse.allNotes.notes : []);
                    setIsSearching(false);
                },
                () => {
                    if (requestIdRef.current !== requestId) {
                        return;
                    }

                    setNotes([]);
                    setIsSearching(false);
                },
            );
        });
    }, [query, setEvent]);

    const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        const nextQuery = query.trim();

        if (nextQuery.length <= 0) {
            return;
        }

        navigate({
            to: SEARCH_ROUTE,
            search: {
                query: nextQuery,
                page: 1,
            },
        });
    };

    const handleReset = () => {
        setQuery('');
    };

    const hasQuery = query.trim().length > 0;
    const hasResults = notes.length > 0;
    const showResultsPanel = hasQuery;
    const showNoQuickMatches = hasQuery && !isSearching && !hasResults;

    return (
        <div className="p-3">
            <form className={formClassName} onSubmit={handleSubmit}>
                <div className={searchSurfaceClassName}>
                    <div
                        className={`${searchRowClassName} ${
                            hasResults ? searchRowWithResultsClassName : searchRowIdleClassName
                        }`}
                    >
                        <button type="submit" aria-label="Search notes" className={iconButtonClassName}>
                            <Icon.Search className="h-4.5 w-4.5" weight="bold" />
                        </button>
                        <input
                            type="text"
                            placeholder="Search notes"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className={searchInputClassName}
                        />
                        {query && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                className={iconButtonClassName}
                                onClick={handleReset}
                            >
                                <Icon.Close className="h-4 w-4" weight="bold" />
                            </button>
                        )}
                    </div>
                    {(showResultsPanel || showNoQuickMatches) && (
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
                                    No quick matches.
                                </Text>
                            )}
                            {notes.length > 0 && (
                                <div>
                                    {notes.map(({ id, title }) => (
                                        <Link key={id} to={NOTE_ROUTE} params={{ id }} className={resultRowClassName}>
                                            <Icon.FileNote className="h-3.5 w-3.5 shrink-0 text-fg-tertiary" />
                                            <Text
                                                as="span"
                                                truncate
                                                variant="meta"
                                                weight="medium"
                                                className={resultTitleClassName}
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
                                        View all results
                                    </Text>
                                    <Icon.ChevronRight className="h-3.5 w-3.5" weight="bold" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default SidebarSearch;
