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
                    <div style={{ gridTemplateColumns: '40px 1fr 32px' }} className="grid flex-1 bg-surface border-2 border-border rounded-[12px_4px_13px_3px/4px_10px_4px_12px] shadow-sketchy">
                        <button type="submit" className="flex items-center justify-center hover:text-accent-primary transition-colors">
                            <Icon.Search className="h-5 w-5" weight="bold" />
                        </button>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="h-10 w-full bg-transparent text-fg-default py-4 outline-none font-bold"
                        />
                        {query && (
                            <button type="button" className="flex items-center justify-center hover:text-accent-primary transition-colors" onClick={handleReset}>
                                <Icon.Close className="h-4 w-4" weight="bold" />
                            </button>
                        )}
                    </div>
                </div>
                {hasResults && (
                    <div className="p-3 bg-surface border-2 border-border rounded-[16px_5px_17px_4px/5px_13px_5px_15px] shadow-sketchy">
                        {notes.length > 0 && (
                            <ul className="flex flex-col">
                                {notes.map(({ id, title }) => (
                                    <li key={id} className="flex py-2 items-center border-b border-dashed border-border-subtle last:border-b-0">
                                        <Link
                                            to={NOTE_ROUTE}
                                            params={{ id }}
                                            className="text-sm font-bold hover:text-accent-primary transition-colors">
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
                        <div className="p-2 border-t border-dashed border-border-subtle">
                            <button type="submit" className="text-sm font-bold text-pastel-blue-200 hover:text-pastel-teal-200 transition-colors">
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
