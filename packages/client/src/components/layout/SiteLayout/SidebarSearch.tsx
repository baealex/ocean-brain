import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';

import { fetchNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import * as Icon from '~/components/icon';
import { Badge } from '~/components/shared';
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
                    <div style={{ gridTemplateColumns: '36px 1fr 28px' }} className="grid flex-1 border-b border-border-subtle">
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
                    <div className="surface-base rounded-[16px] border border-border-subtle p-3">
                        {notes.length > 0 && (
                            <ul className="flex flex-col">
                                {notes.map(({ id, title }) => (
                                    <li key={id} className="flex items-center border-b border-border-subtle/70 py-2 last:border-b-0">
                                        <Link
                                            to={NOTE_ROUTE}
                                            params={{ id }}
                                            className="text-sm font-medium text-fg-default transition-colors hover:text-fg-secondary">
                                            {title || 'Untitled'}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {tags.length > 0 && (
                            <ul className="flex flex-wrap gap-2 p-2">
                                {tags.map(({ id, name }) => (
                                    <li key={id} className="flex items-center gap-2">
                                        <Link
                                            to={TAG_NOTES_ROUTE}
                                            params={{ id }}
                                            search={{ page: 1 }}>
                                            <Badge name={name} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="border-t border-border-subtle/70 p-2">
                            <button type="submit" className="text-sm font-medium text-fg-secondary transition-colors hover:text-fg-default">
                                view detailed results {'>'}
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default SidebarSearch;
