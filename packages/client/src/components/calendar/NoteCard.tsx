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
                    rounded-sketchy-sm
                    px-2 py-1.5
                    hover:brightness-95 dark:hover:brightness-110
                    transition-all
                    h-full flex flex-col justify-center
                `}>
                <div className="font-bold text-xs line-clamp-1 text-fg-default">{note.title}</div>
                <div className="text-fg-secondary text-[10px] font-medium">
                    {dayjs(type === 'create' ? Number(note.createdAt) : Number(note.updatedAt)).format('HH:mm')}
                </div>
            </div>
        </Link>
    );
};
