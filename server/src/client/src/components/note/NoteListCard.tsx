import { Link } from 'react-router-dom';

import { Badge, Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';

import type { Note } from '~/models/note.model';

import { getRandomBackground } from '~/modules/color';
import { timeSince } from '~/modules/time';
import { getNoteURL } from '~/modules/url';
import { PushPinIcon } from '@phosphor-icons/react';

interface Props extends Note {
    onPinned?: () => void;
    onDelete?: () => void;
}

export default function NoteListCard({
    id,
    title,
    tags,
    pinned,
    createdAt,
    updatedAt,
    onPinned,
    onDelete
}: Props) {
    const createdAtText = new Date(Number(createdAt));
    const updatedTimeSince = timeSince(Number(updatedAt));

    return (
        <div key={id} className={`${getRandomBackground(id)} p-4 relative sketchy shadow-sketchy`}>
            {pinned && (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-10">
                    <PushPinIcon weight="fill" className="text-red-500 stroke-black stroke-8 drop-shadow-md" size={28} />
                </div>
            )}
            <div key={id} className="rounded-xl flex justify-between items-center">
                <div className="flex flex-col w-full gap-4">
                    <div className="flex justify-between">
                        <div className="flex flex-col gap-2">
                            <div className="text-fg-default text-xs">{updatedTimeSince}</div>
                            <div className="text-fg-muted text-xs">({createdAtText.toDateString()})</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Dropdown
                                button={(
                                    <Icon.VerticalDots className="w-5 h-5" />
                                )}
                                items={[
                                    {
                                        name: pinned ? 'Unpin' : 'Pin',
                                        onClick: () => onPinned?.()
                                    },
                                    {
                                        name: 'Delete',
                                        onClick: () => onDelete?.()
                                    }
                                ]}
                            />
                        </div>
                    </div>
                    <Link className="font-bold" to={getNoteURL(id)}>
                        {title || 'Untitled'}
                    </Link>
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <Link key={tag.id} to={`/tag/${tag.id}`}>
                                    <Badge name={tag.name} />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
