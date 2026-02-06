import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import type { Note } from '~/models/note.model';
import { getRandomBackground } from '~/modules/color';
import { getNoteURL } from '~/modules/url';
import type { CalendarDisplayType } from './types';

interface Props {
    note: Note;
    type: CalendarDisplayType;
}

export const NoteCard = ({ note, type }: Props) => {
    return (
        <Link to={getNoteURL(note.id)} className="block min-h-[44px]">
            <div
                className={`
                    ${getRandomBackground(note.title)}
                    rounded-[6px_2px_7px_2px/2px_5px_2px_6px]
                    px-2 py-1.5
                    hover:brightness-95 dark:hover:brightness-110
                    transition-all
                    h-full flex flex-col justify-center
                `}>
                <div className="font-bold text-xs line-clamp-1 text-zinc-800 dark:text-zinc-200">{note.title}</div>
                <div className="text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                    {dayjs(type === 'create' ? Number(note.createdAt) : Number(note.updatedAt)).format('HH:mm')}
                </div>
            </div>
        </Link>
    );
};
