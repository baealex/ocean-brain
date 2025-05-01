import styles from './SiteLayout.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React, { Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Icon from '~/components/icon';
import { Badge, RestoreParentScroll, Skeleton } from '~/components/shared';

import useDebounce from '~/hooks/useDebounce';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import type { Note } from '~/models/note.model';
import type { Tag } from '~/models/tag.model';

import { useTheme } from '~/store/theme';

import { fetchNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import { getServerCache, setServerCache } from '~/apis/server-cache.api';
import { confirm } from '@baejino/ui';
import { PinnedNotes } from '~/components/entities';

interface SiteLayoutProps {
    children?: React.ReactNode;
}

const NAVIGATION_ITEMS = [
    {
        name: 'Notes',
        path: '/',
        icon: Icon.Document
    },
    {
        name: 'Calendar',
        path: '/calendar',
        icon: Icon.Calendar
    },
    {
        name: 'Tags',
        path: '/tag',
        icon: Icon.Star
    },
    {
        name: 'Images',
        path: '/manage-image',
        icon: Icon.Gallery
    },
    {
        name: 'Placeholders',
        path: '/placeholder',
        icon: Icon.Copy
    }
];

const SiteLayout = ({ children }: SiteLayoutProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { theme, toggleTheme } = useTheme(state => state);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [notes, setNotes] = useState<Note[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);

    const [, setEvent] = useDebounce(500);

    const { onCreate } = useNoteMutate();

    const { data: heroBanner } = useQuery({
        queryKey: ['heroBanner'],
        async queryFn() {
            return getServerCache('heroBanner');
        }
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
                {heroBanner && (
                    <img
                        width="100%"
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '24px',
                            filter: theme === 'dark' ? 'brightness(.8) contrast(1.2)' : undefined
                        }}
                        onClick={async () => {
                            if (await confirm('Do you want to remove this hero banner?')) {
                                await setServerCache('heroBanner', '');
                                await queryClient.invalidateQueries({ queryKey: ['heroBanner'] });
                            }
                        }}
                        src={heroBanner}
                    />
                )}
                <div className="p-3">
                    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                        <div className="flex gap-3">
                            <div style={{ gridTemplateColumns: '40px 1fr 32px' }} className="grid flex-1 bg-white dark:bg-zinc-800 rounded-lg shadow-md">
                                <button type="submit" className="flex items-center justify-center">
                                    <Icon.Search className="h-6 w-6" />
                                </button>
                                <input
                                    type="text"
                                    placeholder="Search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="h-10 w-full bg-transparent text-gray-900 dark:text-gray-300 py-4 outline-none"
                                />
                                {query && (
                                    <button type="button" className="flex items-center justify-center" onClick={handleReset}>
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
                            <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-md">
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

                <div className={cx('p-3', 'flex', 'flex-col', 'gap-2')}>
                    <button
                        className="font-bold flex gap-2 items-center p-2 rounded-lg bg-black text-white w-full"
                        onClick={() => onCreate()}>
                        <Icon.Pencil className="w-4" /> Capture
                    </button>
                    <div className={cx('font-bold', 'flex', 'items-center', 'gap-2', 'p-2')}>
                        <Icon.Pin className="w-4" />
                        Pinned
                    </div>
                    <div className="flex flex-col gap-2 pl-12">
                        <Suspense
                            fallback={(
                                <>
                                    <Skeleton height="24px" opacity={0.5} />
                                    <Skeleton height="24px" opacity={0.5} />
                                </>
                            )}>
                            <PinnedNotes
                                render={(notes) => notes?.map((note) => (
                                    <Link
                                        key={note.id}
                                        className={cx('list-item', {
                                            'opacity-100': location.pathname === `/${note.id}`,
                                            'opacity-50': location.pathname !== `/${note.id}`
                                        })}
                                        to={`/${note.id}`}>
                                        {note.title}
                                    </Link>
                                ))}
                            />
                        </Suspense>
                    </div>
                </div>
            </div>
            <div className={cx('center')}>
                <div className={cx('top')}>
                    <div className={cx('top-content')}>
                        <div className={cx('flex', 'gap-5', 'p-3')}>
                            {NAVIGATION_ITEMS.map((item) => (
                                <Link key={item.path} to={item.path}>
                                    <div className={cx('flex items-center gap-2 text-sm', { 'opacity-50': location.pathname !== item.path }, { 'opacity-100': location.pathname === item.path })}>
                                        <item.icon className="size-4" />
                                        {item.name}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
                <div className={cx('content')}>
                    {children}
                </div>
                <RestoreParentScroll />
            </div>
        </div>
    );
};

export default SiteLayout;
