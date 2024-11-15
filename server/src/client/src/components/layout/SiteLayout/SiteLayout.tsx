import styles from './SiteLayout.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Icon from '~/components/icon';
import { Badge, RestoreParentScroll } from '~/components/shared';

import useDebounce from '~/hooks/useDebounce';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import type { Note } from '~/models/Note';
import type { Tag } from '~/models/Tag';

import { graphQuery } from '~/modules/graph-query';

import { useTheme } from '~/store/theme';

import { fetchNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';

interface SiteLayoutProps {
    children?: React.ReactNode;
}

const NAVIGATION_ITEMS = [
    {
        name: 'Notes',
        path: '/',
        icon: Icon.FloppyDisk
    },
    {
        name: 'Calendar',
        path: '/calendar',
        icon: Icon.FloppyDisk
    },
    {
        name: 'Tags',
        path: '/tag',
        icon: Icon.FloppyDisk
    },
    {
        name: 'Images',
        path: '/manage-image',
        icon: Icon.FloppyDisk
    }
];

const SiteLayout = ({ children }: SiteLayoutProps) => {
    const location = useLocation();
    const navigate = useNavigate();

    const { theme, toggleTheme } = useTheme(state => state);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [notes, setNotes] = useState<Note[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);

    const [, setEvent] = useDebounce(500);

    const { onCreate } = useNoteMutate();

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

    const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
        e?.preventDefault();
        navigate(`/search?query=${encodeURIComponent(query)}`);
    };

    const handleReset = () => {
        setQuery('');
    };

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
        <div className={cx('SiteLayout')}>
            <div className="md:hidden">
                <button
                    type="button"
                    className={cx('menu')}
                    onClick={() => setIsMenuOpen(prev => !prev)}>
                    <Icon.Menu className="h-6 w-6" />
                </button>
            </div>
            <div className={cx('side', { 'open': isMenuOpen })}>
                <div className={cx('flex', 'justify-between', 'gap-3', 'p-3')}>
                    <form className="w-full" onSubmit={handleSubmit}>
                        <div className="flex gap-3">
                            <div className="flex w-full gap-1 bg-white dark:bg-zinc-800 rounded-lg shadow-md">
                                <button type="submit" className="h-10 w-10 flex items-center justify-center">
                                    <Icon.Search className="h-6 w-6" />
                                </button>
                                <input
                                    type="text"
                                    placeholder="Search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="w-full h-10 bg-transparent text-gray-900 dark:text-gray-300 py-4 outline-none"
                                />
                                {query && (
                                    <button type="button" className="h-10 w-10 flex items-center justify-center" onClick={handleReset}>
                                        <Icon.Close className="h-4 w-4 dark:text-gray-300" />
                                    </button>
                                )}
                            </div>
                            <button type="button" onClick={toggleTheme}>
                                {theme === 'dark' ? (
                                    <Icon.Moon className="h-6 w-6 text-yellow-500" />
                                ) : (
                                    <Icon.Sun className="h-6 w-6 text-black" />
                                )}
                            </button>
                        </div>
                        {(notes.length > 0 || tags.length > 0) && (
                            <div className="mt-3 p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-md">
                                {notes.length > 0 && (
                                    <ul className="flex flex-col">
                                        {notes.map(({ id, title }) => (
                                            <li key={id} className="flex py-3 items-center">
                                                <div className="flex items-center gap-2">
                                                    <Link to={`/${id}`}>
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
                                                <Link to={`/tag/${id}`}>
                                                    <Badge name={name} />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="p-2">
                                    <button type="submit" className="text-sm text-blue-500">
                                        view detailed results
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
                <div className={cx('flex', 'flex-col', 'gap-2', 'p-3')}>
                    <button
                        className="font-bold flex gap-2 items-center bg-black shadow-lg text-white p-2 rounded-lg"
                        onClick={() => onCreate()}>
                        <Icon.Pencil className="w-4" /> Capture
                    </button>
                    {NAVIGATION_ITEMS.map((item) => (
                        <Link to={item.path}>
                            <div className={cx('font-bold', 'p-2', 'flex items-center gap-2', 'rounded-lg', { 'bg-zinc-50 dark:bg-zinc-900 shadow-lg': location.pathname === item.path })}>
                                <item.icon className="w-4" />
                                {item.name}
                            </div>
                        </Link>
                    ))}
                </div>
                <div className={cx('p-3')}>
                    <div className={cx('font-bold', 'text-xs', 'flex', 'items-center', 'gap-2', 'p-2')}>
                        <Icon.Pin className="w-4" />
                        PINNED
                    </div>
                    <div className="flex flex-col gap-2 mt-1 pl-8">
                        {pinnedNode?.map((note) => (
                            <Link className={cx({ 'opacity-30': location.pathname === `/${note.id}` })} to={`/${note.id}`}>
                                {note.title}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
            <div className={cx('center')}>
                <div className={cx('content')}>
                    {children}
                    <RestoreParentScroll/>
                </div>
            </div>
        </div >
    );
};

export default SiteLayout;
