import dayjs from 'dayjs';

import type { Note } from '~/models/note.model';
import { CalendarEntryCard } from './CalendarEntryCard';
import type { CalendarDisplayType } from './types';

interface Props {
    note: Note;
    type: CalendarDisplayType;
}

export const NoteCard = ({ note, type }: Props) => {
    return (
        <CalendarEntryCard
            params={{ id: note.id }}
            title={note.title}
            meta={dayjs(type === 'create' ? Number(note.createdAt) : Number(note.updatedAt)).format('HH:mm')}
        />
    );
};
