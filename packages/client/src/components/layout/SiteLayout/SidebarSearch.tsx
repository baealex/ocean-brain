import { Link, useNavigate } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { fetchNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import useDebounce from '~/hooks/useDebounce';
import type { Note } from '~/models/note.model';
import type { Tag } from '~/models/tag.model';
import { NOTE_ROUTE, SEARCH_ROUTE, TAG_NOTES_ROUTE } from '~/modules/url';

const formClassName = 'flex flex-col gap-2.5';
const searchSurfaceClassName = 'surface-base overflow-hidden';
const searchRowClassName =
    'grid-search-bar grid items-center border-b border-transparent px-2.5 py-1.5 transition-colors';
const searchRowWithResultsClassName = 'border-border-subtle/70 bg-muted/25';
const searchRowIdleClassName = 'hover:bg-hover-subtle/60';
const iconButtonClassName =
    'flex h-10 items-center justify-center text-fg-tertiary transition-colors hover:text-fg-default sm:h-8';
const searchInputClassName =
    'h-10 w-full bg-transparent py-2 text-meta text-fg-default outline-none placeholder:text-fg-placeholder sm:h-8 sm:py-1.5';
const resultsPanelClassName = 'px-1 py-1.5';
const resultSectionLabelClassName = 'px-2 pb-0.5 pt-1';
const resultSecondarySectionLabelClassName = 'px-2 pb-0.5 pt-1.5';
const resultRowClassName =
    'flex min-h-10 items-center gap-2 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-hover-subtle sm:min-h-0 sm:px-2 sm:py-1.5';
const resultTitleClassName = 'min-w-0 flex-1';
const tagWrapClassName = 'flex flex-wrap gap-1.5 px-1.5 py-1';
const tagChipClassName =
    'inline-flex items-center rounded-full border border-border-subtle bg-hover-subtle px-2 py-0.75 sm:py-0.5';
const footerWrapClassName = 'mt-1 border-t border-border-subtle/50 px-2 pb-0.5 pt-1.5';
const footerActionClassName =
    'flex min-h-9 items-center gap-1.5 text-fg-secondary transition-colors hover:text-fg-default';

const SidebarSearch = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [notes, setNotes] = useState<Note[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [, setEvent] = useDebounce(500);

    useEffect(() => {
        if (query.length <= 0) {
            setEvent(() => undefined);
            setNotes([]);
            setTags([]);
            return;
        }

        setEvent(() => {
            fetchNotes({
                query,
                limit: 5,
            }).then((response) => {
                if (response.type === 'success') {
                    setNotes(response.allNotes.notes);
                }
            });

            fetchTags({
                query,
                limit: 5,
            }).then((response) => {
                if (response.type === 'success') {
                    setTags(response.allTags.tags);
                }
            });
        });
    }, [query, setEvent]);

    const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        navigate({
            to: SEARCH_ROUTE,
            search: {
                query,
                page: 1,
            },
        });
    };

    const handleReset = () => {
        setQuery('');
    };

    const hasResults = notes.length > 0 || tags.length > 0;

    return (
        <div className="p-3">
            <form className={formClassName} onSubmit={handleSubmit}>
                <div className={searchSurfaceClassName}>
                    <div
                        className={`${searchRowClassName} ${
                            hasResults ? searchRowWithResultsClassName : searchRowIdleClassName
                        }`}
                    >
                        <button type="submit" className={iconButtonClassName}>
                            <Icon.Search className="h-4.5 w-4.5" weight="bold" />
                        </button>
                        <input
                            type="text"
                            placeholder="Search notes or tags"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className={searchInputClassName}
                        />
                        {query && (
                            <button type="button" className={iconButtonClassName} onClick={handleReset}>
                                <Icon.Close className="h-4 w-4" weight="bold" />
                            </button>
                        )}
                    </div>
                    {hasResults && (
                        <div className={resultsPanelClassName}>
                            {notes.length > 0 && (
                                <div>
                                    {tags.length > 0 && (
                                        <Text
                                            as="div"
                                            variant="label"
                                            weight="medium"
                                            tone="tertiary"
                                            className={resultSectionLabelClassName}
                                        >
                                            Notes
                                        </Text>
                                    )}
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
                            {tags.length > 0 && (
                                <div>
                                    {notes.length > 0 && (
                                        <Text
                                            as="div"
                                            variant="label"
                                            weight="medium"
                                            tone="tertiary"
                                            className={resultSecondarySectionLabelClassName}
                                        >
                                            Tags
                                        </Text>
                                    )}
                                    <div className={tagWrapClassName}>
                                        {tags.map(({ id, name }) => (
                                            <Link key={id} to={TAG_NOTES_ROUTE} params={{ id }} search={{ page: 1 }}>
                                                <Text
                                                    as="span"
                                                    variant="label"
                                                    weight="medium"
                                                    tone="secondary"
                                                    className={tagChipClassName}
                                                >
                                                    {name}
                                                </Text>
                                            </Link>
                                        ))}
                                    </div>
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
