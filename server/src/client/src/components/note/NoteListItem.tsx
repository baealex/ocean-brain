import { Link } from 'react-router-dom';

import { Badge } from '~/components/shared';

import type { Note } from '~/models/note.model';

import { timeSince } from '~/modules/time';
import { getNoteURL } from '~/modules/url';

interface Props {
    id: string;
    title: string;
    tags?: Note['tags'];
    pinned?: boolean;
    createdAt: string;
    updatedAt: string;
}

export default function NoteListItem({
    id,
    title,
    tags,
    createdAt,
    updatedAt
}: Props) {
    const createdAtText = new Date(Number(createdAt));
    const updatedTimeSince = timeSince(Number(updatedAt));

    return (
        <div className="border-b-2 border-dashed border-zinc-300 dark:border-zinc-700 last:border-b-0">
            <div className="py-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">{updatedTimeSince}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs">({createdAtText.toDateString()})</span>
                </div>
                <Link
                    className="font-bold text-zinc-800 dark:text-zinc-200 hover:text-pastel-pink-200 dark:hover:text-pastel-purple-200 transition-colors"
                    to={getNoteURL(id)}>
                    {title || 'Untitled'}
                </Link>
                {tags && tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                            <Link key={tag.id} to={`/tag/${tag.id}`}>
                                <Badge name={tag.name} />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
