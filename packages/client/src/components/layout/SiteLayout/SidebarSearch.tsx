import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';

import { fetchNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import * as Icon from '~/components/icon';
import { Badge } from '~/components/shared';
import { Text } from '~/components/ui';
import useDebounce from '~/hooks/useDebounce';
import type { Note } from '~/models/note.model';
import type { Tag } from '~/models/tag.model';
import { NOTE_ROUTE, SEARCH_ROUTE, TAG_NOTES_ROUTE } from '~/modules/url';

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
                limit: 5
            }).then((response) => {
                if (response.type === 'success') {
                    setNotes(response.allNotes.notes);
                }
            });

            fetchTags({
                query,
                limit: 5
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
                page: 1
            }
        });
    };

    const handleReset = () => {
        setQuery('');
    };

    const hasResults = notes.length > 0 || tags.length > 0;

    return (
        <div className="p-3">
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                <div className="flex gap-3">
                    <div className="grid-search-bar grid flex-1 rounded-[14px] border border-border-subtle bg-surface transition-colors hover:border-border">
                        <button type="submit" className="flex items-center justify-center text-fg-tertiary transition-colors hover:text-fg-default">
                            <Icon.Search className="h-4.5 w-4.5" weight="bold" />
                        </button>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="h-9 w-full bg-transparent py-2 text-sm text-fg-default outline-none"
                        />
                        {query && (
                            <button type="button" className="flex items-center justify-center text-fg-tertiary transition-colors hover:text-fg-default" onClick={handleReset}>
                                <Icon.Close className="h-4 w-4" weight="bold" />
                            </button>
                        )}
                    </div>
                </div>
                {hasResults && (
                    <div className="surface-base overflow-hidden p-1.5">
                        {notes.length > 0 && (
                            <div>
                                {tags.length > 0 && (
                                    <Text
                                        as="div"
                                        variant="label"
                                        weight="medium"
                                        tone="tertiary"
                                        className="px-2.5 pb-1 pt-1">
                                        Notes
                                    </Text>
                                )}
                                {notes.map(({ id, title }) => (
                                    <Link
                                        key={id}
                                        to={NOTE_ROUTE}
                                        params={{ id }}
                                        className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-hover-subtle">
                                        <Icon.FileNote className="h-4 w-4 shrink-0 text-fg-tertiary" />
                                        <Text as="span" truncate className="min-w-0 flex-1">
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
                                        className="px-2.5 pb-1 pt-2">
                                        Tags
                                    </Text>
                                )}
                                <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
                                    {tags.map(({ id, name }) => (
                                        <Link key={id} to={TAG_NOTES_ROUTE} params={{ id }} search={{ page: 1 }}>
                                            <Badge name={name} />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="mt-1 border-t border-border-subtle/50 px-2.5 pb-1 pt-1.5">
                            <button type="submit" className="flex items-center gap-1.5 text-fg-secondary transition-colors hover:text-fg-default">
                                <Text as="span" variant="meta" weight="medium" className="text-current">
                                    view detailed results
                                </Text>
                                <Icon.ChevronRight className="h-3.5 w-3.5" weight="bold" />
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default SidebarSearch;
