import styles from './SiteLayout.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { Link, useLocation } from 'react-router-dom';

import Badge from '~/components/shared/Badge';

import useDebounce from '~/hooks/useDebounce';

import type { Note } from '~/models/Note';
import type { Tag } from '~/models/Tag';

import { graphQuery } from '~/modules/graph-query';

import { useTheme } from '~/store/theme';

import { fetchNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import { Menu, Moon, Search, Sun } from '~/components/icon';

interface SiteLayoutProps {
    children?: React.ReactNode;
}

const NAVIGATION_ITEMS = [
    {
        name: 'Notes',
        path: '/'
    },
    {
        name: 'Tags',
        path: '/tag'
    },
    {
        name: 'Images',
        path: '/manage-image'
    }
];

const NavigationItem = ({
    isActive,
    name,
    path
}: {
    isActive: boolean;
    name: string;
    path: string;
}) => (
    <div className={cx('text-gray-800 dark:text-gray-300')}>
        <Link className={cx({ 'highlight': isActive })} to={path}>{name}</Link>
    </div>
);

const SiteLayout = ({ children }: SiteLayoutProps) => {
    const location = useLocation();

    const { theme, toggleTheme } = useTheme(state => state);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [notes, setNotes] = useState<Note[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);

    const [, setEvent] = useDebounce(100);

    const reset = () => {
        setNotes([]);
        setTags([]);
        setQuery('');
    };

    const { data: pinnedNode } = useQuery('pinned-notes', async () => {
        const { pinnedNotes } = await graphQuery<{
            pinnedNotes: Note[];
        }>(`
            query {
                pinnedNotes {
                    id
                    title
                }
            }
        `);
        return pinnedNotes;
    });

    useEffect(() => {
        if (query.length <= 0) {
            setEvent(() => { });
            setNotes([]);
            setTags([]);
            return;
        }
        setEvent(() => {
            fetchNotes({
                query,
                limit: 5
            }).then(({ notes }) => setNotes(notes));
            fetchTags({
                query,
                limit: 5
            }).then(({ tags }) => setTags(tags));
        });
    }, [query]);

    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className={cx('SiteLayout', 'dark:bg-zinc-950')}>
            <div className={cx('side', { 'open': isMenuOpen }, 'dark:bg-zinc-950')}>
                <div className={cx('flex', 'flex-col', 'gap-2', 'mt-16', 'p-4')}>
                    <div className={cx('font-bold', 'text-lg')}>
                        MENU
                    </div>
                    {NAVIGATION_ITEMS.map((item) => (
                        <NavigationItem
                            isActive={location.pathname === item.path}
                            name={item.name}
                            path={item.path}
                        />
                    ))}
                </div>
                <div className={cx('flex', 'flex-col', 'gap-2', 'mt-4', 'p-4')}>
                    <div className={cx('font-bold', 'text-lg')}>
                        PINNED
                    </div>
                    {pinnedNode?.map((note) => (
                        <NavigationItem
                            isActive={location.pathname === `/${note.id}`}
                            name={note.title}
                            path={`/${note.id}`}
                        />
                    ))}
                </div>
            </div>
            <div className={cx('center')}>
                <div className={cx('header', 'relative')}>
                    <div className={cx('flex', 'justify-between', 'gap-3', 'p-3')}>
                        <div className={cx('flex', 'gap-3', 'items-center')}>
                            <button
                                type="button"
                                className="flex items-center justify-center gap-2 md:hidden"
                                onClick={() => setIsMenuOpen(prev => !prev)}>
                                <Menu className="h-6 w-6" />
                            </button>
                        </div>
                        <div className={cx('flex', 'gap-3', 'items-center')}>
                            <div className="relative">
                                <form className="flex gap-1 bg-white dark:bg-zinc-800 rounded-lg">
                                    <button type="button" className="h-10 w-10 flex items-center justify-center rounded-lg border-2 border-white dark:border-black">
                                        <Search className="h-6 w-6 dark:text-gray-300" />
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="Search"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        className="w-48 h-10 bg-transparent text-gray-900 dark:text-gray-300 py-4 outline-none"
                                    />
                                </form>
                                {(notes.length > 0 || tags.length > 0) && (
                                    <div style={{ zIndex: 1002 }} className="fixed top-16 w-60 bg-white card sub dark:bg-zinc-900 rounded-lg shadow-lg text-gray-900 dark:text-gray-300">
                                        {notes.length > 0 && (
                                            <ul className="flex flex-col">
                                                {notes.map(({ id, title }) => (
                                                    <li key={id} className="flex p-3 items-center border-b border-zinc-100 dark:border-zinc-800 border-solid">
                                                        <div className="flex items-center gap-2">
                                                            <Link to={`/${id}`} onClick={reset}>
                                                                <p className="text-sm">{title || 'Untitled'}</p>
                                                            </Link>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {tags.length > 0 && (
                                            <ul className="flex flex-wrap gap-2 p-2">
                                                {tags.map(({ id, name }) => (
                                                    <li key={id} className="flex items-center gap-2">
                                                        <Link to={`/tag/${id}`} onClick={reset}>
                                                            <Badge name={name} />
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button onClick={toggleTheme}>
                                {theme === 'dark' ? (
                                    <Moon className="h-6 w-6 text-yellow-500" />
                                ) : (
                                    <Sun className="h-6 w-6 text-baclk" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                <div className={cx('content')}>
                    {children}
                </div>
            </div>
        </div >
    );
};

export default SiteLayout;
