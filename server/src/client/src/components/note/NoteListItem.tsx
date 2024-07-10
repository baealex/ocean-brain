import { Link } from 'react-router-dom';

import { Badge } from '~/components/shared';
import * as Icon from '~/components/icon';

import type { Note } from '~/models/Note';

import { timeSince } from '~/modules/time';
import { getNoteURL, getTagURL } from '~/modules/url';

interface Props {
    id: string;
    title: string;
    tags?: Note['tags'];
    pinned?: boolean;
    createdAt: string;
    updatedAt: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onPinned?: () => void;
}

export default function NoteListItem({
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
        <div key={id} className="border-b border-zinc-200 dark:border-zinc-800 border-solid">
            <div key={id} className="py-6 rounded-xl flex justify-between items-center">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="text-gray-500 dark:text-gray-300 text-xs">{updatedTimeSince}</div>
                        <div className="text-gray-400 text-xs">({createdAtText.toDateString()})</div>
                    </div>
                    <Link className="font-bold" to={getNoteURL(id)}>
                        {title || 'Untitled'}
                    </Link>
                    {tags && tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <Link key={tag.id} to={getTagURL(tag.id)}>
                                    <Badge name={tag.name} />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onPinned && (
                        <button className="text-gary-700 font-bold h-10 w-10 rounded-md flex justify-center items-center" onClick={onPinned}>
                            <Icon.Pin className={`h-5 w-5 ${pinned ? 'text-red-500' : 'text-gray-500'}`} />
                        </button>
                    )}
                    {onDelete && (
                        <button className="text-gary-700 font-bold h-10 w-10 rounded-md flex justify-center items-center" onClick={onDelete}>
                            <Icon.TrashCan className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
