import styles from './SiteLayout.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React, { Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Icon from '~/components/icon';
import { Badge, RestoreParentScroll, Skeleton } from '~/components/shared';

import useDebounce from '~/hooks/useDebounce';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import type { Note } from '~/models/Note';
import type { Tag } from '~/models/Tag';

import { useTheme } from '~/store/theme';

import { fetchNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import { getCustomize, updateCustomize } from '~/apis/customize.api';
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

    const { data: customize } = useQuery('customize', async () => {
        return getCustomize();
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

    const background = theme === 'light' ? customize?.color || '#FCEBAF' : '#1e1f22';

    const colorArray = [
        '#FCEBAF',
        '#B2E0B2',
        '#FFB3C1',
        '#FFCCB3',
        '#A4D8E1',
        '#E1B7E1',
        '#A4DBD6',
        '#E1C6E7'
    ];

    return (
        <div className={cx('SiteLayout')}>
            <div className="md:hidden">
                <button
                    type="button"
                    style={{ background }}
                    className={cx('menu')}
                    onClick={() => setIsMenuOpen(prev => !prev)}>
                    <Icon.Menu className="h-6 w-6" />
                </button>
            </div>
            <div style={{ background }} className={cx('side', { 'open': isMenuOpen })}>
                {customize?.heroBanner && (
                    <img
                        width="100%"
                        style={{
                            width: '100%',
                            filter: theme === 'dark' ? 'brightness(.8) contrast(1.2)' : undefined
                        }}
                        onClick={async () => {
                            if (await confirm('Do you want to remove this hero banner?')) {
                                await updateCustomize({ heroBanner: '' });
                                await queryClient.invalidateQueries('customize');
                            }
                        }}
                        src={customize.heroBanner}
                    />
                )}
                <div className="mt-3 p-3">
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
                <div className={cx('flex', 'flex-col', 'gap-2', 'p-3')}>
                    <button
                        className="font-bold flex gap-2 items-center bg-black shadow-lg text-white p-2 rounded-lg"
                        onClick={() => onCreate()}>
                        <Icon.Pencil className="w-4" /> Capture
                    </button>
                    {NAVIGATION_ITEMS.map((item) => (
                        <Link key={item.path} to={item.path}>
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
                        <Suspense
                            fallback={(
                                <>
                                    <Skeleton height="24px" opacity={0.5} />
                                    <Skeleton height="24px" opacity={0.5} />
                                </>
                            )}>
                            <PinnedNotes
                                render={(notes) => notes?.map((note) => (
                                    <Link key={note.id} className={cx({ 'opacity-30': location.pathname === `/${note.id}` })} to={`/${note.id}`}>
                                        {note.title}
                                    </Link>
                                ))}
                            />
                        </Suspense>
                    </div>
                </div>
                {theme === 'light' && (
                    <div className="flex flex-wrap p-3 gap-4 justify-center mt-5">
                        {colorArray.map((colorCode, index) => (
                            <div
                                key={index}
                                onClick={async () => {
                                    await updateCustomize({ color: colorCode });
                                    await queryClient.invalidateQueries('customize');
                                }}
                                style={{
                                    backgroundColor: colorCode,
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    border: '1px solid #000',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div className={cx('center')}>
                <div className={cx('content')}>
                    {children}
                </div>
                <RestoreParentScroll />
            </div>
        </div>
    );
};

export default SiteLayout;
