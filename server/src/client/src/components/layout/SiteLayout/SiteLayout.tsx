import styles from './SiteLayout.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React, { Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Icon from '~/components/icon';
import { Badge, RestoreParentScroll, Skeleton } from '~/components/shared';
import { Button, Tooltip, useConfirm } from '~/components/ui';

import type { DragEndEvent } from '@dnd-kit/core';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import useDebounce from '~/hooks/useDebounce';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import type { Note } from '~/models/note.model';
import type { Tag } from '~/models/tag.model';

import { useTheme } from '~/store/theme';

import { fetchNotes, reorderNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import { getServerCache, setServerCache } from '~/apis/server-cache.api';
import { PinnedNotes } from '~/components/entities';
import { getPinnedNoteQueryKey } from '~/modules/query-key-factory';

interface SiteLayoutProps {
    children?: React.ReactNode;
}

interface SortableItemProps {
    id: string;
    children: React.ReactNode;
    tooltip?: string;
}

function SortableItem({ id, children, tooltip }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        setActivatorNodeRef
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    const textContent = (
        <div className="flex-1 min-w-0 font-bold text-sm truncate">
            {children}
        </div>
    );

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-2 p-2 rounded-md hover:bg-pastel-lavender-200/30 dark:hover:bg-zinc-800/50 transition-colors">
            <button
                ref={setActivatorNodeRef}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none flex items-center justify-center"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
                <Icon.Menu className="size-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" />
            </button>
            {tooltip ? (
                <Tooltip content={tooltip} side="right">
                    {textContent}
                </Tooltip>
            ) : textContent}
        </div>
    );
}

interface PinnedNotesListProps {
    notes: Pick<Note, 'id' | 'title' | 'order'>[];
    sensors: ReturnType<typeof useSensors>;
    handleDragEnd: (event: DragEndEvent) => void;
    location: ReturnType<typeof useLocation>;
    pinnedItems: Pick<Note, 'id' | 'title' | 'order'>[];
    setPinnedItems: React.Dispatch<React.SetStateAction<Pick<Note, 'id' | 'title' | 'order'>[]>>;
}

function PinnedNotesList({
    notes, sensors, handleDragEnd, location, pinnedItems, setPinnedItems
}: PinnedNotesListProps) {
    React.useEffect(() => {
        if (notes && notes.length > 0) {
            setPinnedItems(notes);
        }
    }, [notes, setPinnedItems]);

    const items = pinnedItems.length > 0 ? pinnedItems : notes;

    if (!items || items.length === 0) {
        return null;
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
                {items.map((note) => (
                    <SortableItem key={note.id} id={note.id} tooltip={note.title || 'Untitled'}>
                        <Link
                            className={`transition-colors ${
                                location.pathname === `/${note.id}`
                                    ? 'text-pastel-pink-200 dark:text-pastel-purple-200'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                            to={`/${note.id}`}>
                            {note.title || 'Untitled'}
                        </Link>
                    </SortableItem>
                ))}
            </SortableContext>
        </DndContext>
    );
}

const NAVIGATION_ITEMS = [
    {
        name: 'Notes',
        path: '/',
        icon: Icon.Grid
    },
    {
        name: 'Calendar',
        path: '/calendar',
        icon: Icon.Calendar
    },
    {
        name: 'Reminders',
        path: '/reminders',
        icon: Icon.Bell
    },
    {
        name: 'Tags',
        path: '/tag',
        icon: Icon.Tag
    },
    {
        name: 'Setting',
        path: '/setting',
        icon: Icon.Gear
    }
];

const SiteLayout = ({ children }: SiteLayoutProps) => {
    const confirm = useConfirm();
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { theme } = useTheme(state => state);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [notes, setNotes] = useState<Note[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [pinnedItems, setPinnedItems] = useState<Pick<Note, 'id' | 'title' | 'order'>[]>([]);

    const [, setEvent] = useDebounce(500);

    const { onCreate } = useNoteMutate();

    const reorderMutation = useMutation({
        mutationFn: reorderNotes,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [getPinnedNoteQueryKey()] });
        }
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPinnedItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    order: index
                }));

                reorderMutation.mutate(updates);

                return newItems;
            });
        }
    };

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
    }, [query, setEvent]);

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
                            <div style={{ gridTemplateColumns: '40px 1fr 32px' }} className="grid flex-1 bg-surface dark:bg-surface-dark border-2 border-zinc-800 dark:border-zinc-700 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] shadow-sketchy">
                                <button type="submit" className="flex items-center justify-center hover:text-pastel-pink-200 transition-colors">
                                    <Icon.Search className="h-5 w-5" weight="bold" />
                                </button>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="h-10 w-full bg-transparent text-zinc-800 dark:text-zinc-200 py-4 outline-none font-bold"
                                />
                                {query && (
                                    <button type="button" className="flex items-center justify-center hover:text-pastel-pink-200 transition-colors" onClick={handleReset}>
                                        <Icon.Close className="h-4 w-4" weight="bold" />
                                    </button>
                                )}
                            </div>
                        </div>
                        {(notes.length > 0 || tags.length > 0) && (
                            <div className="p-3 bg-surface dark:bg-surface-dark border-2 border-zinc-800 dark:border-zinc-700 rounded-[16px_5px_17px_4px/5px_13px_5px_15px] shadow-sketchy">
                                {notes.length > 0 && (
                                    <ul className="flex flex-col">
                                        {notes.map(({ id, title }) => (
                                            <li key={id} className="flex py-2 items-center border-b border-dashed border-zinc-300 dark:border-zinc-600 last:border-b-0">
                                                <Link to={`/${id}`} className="text-sm font-bold hover:text-pastel-pink-200 transition-colors">
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
                                                <Link to={`/tag/${id}`}>
                                                    <Badge name={name} />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="p-2 border-t border-dashed border-zinc-300 dark:border-zinc-600">
                                    <button type="submit" className="text-sm font-bold text-pastel-blue-200 hover:text-pastel-teal-200 transition-colors">
                                        view detailed results →
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                <div className={cx('p-3', 'flex', 'flex-col', 'gap-2')}>
                    <Button
                        variant="danger"
                        size="lg"
                        className="w-full shadow-sketchy"
                        onClick={() => onCreate()}>
                        <Icon.Pencil className="w-5 h-5" weight="bold" /> Capture
                    </Button>
                    <div className={cx('font-bold', 'flex', 'items-center', 'gap-2', 'p-2', 'pt-6', 'mt-5', 'border-t-2', 'border-dashed', 'border-zinc-300', 'dark:border-zinc-600')}>
                        <Icon.Pin className="w-5 h-5" weight="fill" />
                        Pinned
                    </div>
                    <div className="flex flex-col gap-2">
                        <Suspense
                            fallback={(
                                <>
                                    <Skeleton height="24px" opacity={0.5} />
                                    <Skeleton height="24px" opacity={0.5} />
                                </>
                            )}>
                            <PinnedNotes
                                render={(notes) => (
                                    <PinnedNotesList
                                        notes={notes}
                                        sensors={sensors}
                                        handleDragEnd={handleDragEnd}
                                        location={location}
                                        pinnedItems={pinnedItems}
                                        setPinnedItems={setPinnedItems}
                                    />
                                )}
                            />
                        </Suspense>
                    </div>
                </div>
            </div>
            <div className={cx('center')}>
                <div className={cx('top')}>
                    <div className={cx('top-content')}>
                        <div className={cx('flex', 'gap-2', 'p-3')}>
                            {NAVIGATION_ITEMS.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link key={item.path} to={item.path}>
                                        <div
                                            className={`flex items-center gap-2 text-sm font-bold px-3 py-2 border-2 transition-all rounded-[10px_3px_11px_3px/3px_8px_3px_10px] ${
                                            isActive
                                                ? 'bg-pastel-yellow-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-800 dark:border-zinc-600 shadow-sketchy'
                                                : 'border-transparent hover:border-zinc-800 dark:hover:border-zinc-600 hover:bg-pastel-lavender-200/50 dark:hover:bg-zinc-700/50'
                                        }`}>
                                            <item.icon className="size-5" weight={isActive ? 'fill' : 'regular'} />
                                            {item.name}
                                        </div>
                                    </Link>
                                );
                            })}
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
