import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import * as Icon from '~/components/icon';
import type { Reminder } from '~/models/reminder.model';
import { priorityColors, overdueColor } from '~/modules/color';
import { getNoteURL } from '~/modules/url';

interface Props {
    reminder: Reminder;
    isPast: boolean;
}

export const ReminderCard = ({ reminder, isPast }: Props) => {
    const isOverdue = isPast && !reminder.completed;
    const priority = reminder.priority || 'medium';

    return (
        <Link to={getNoteURL(reminder.note?.id || '')} className="block min-h-[44px]">
            <div
                className={`
                    rounded-[6px_2px_7px_2px/2px_5px_2px_6px]
                    px-2 py-1.5
                    hover:brightness-95 dark:hover:brightness-110
                    transition-all
                    h-full flex flex-col justify-center
                    ${isOverdue ? overdueColor : priorityColors[priority]}
                    ${reminder.completed ? 'opacity-40' : ''}
                `}>
                <div className="flex items-center gap-1 mb-0.5">
                    <Icon.Bell size={12} className="text-zinc-700 dark:text-zinc-300" />
                    {isOverdue && (
                        <span className="text-[9px] font-bold text-red-700 dark:text-red-400">!</span>
                    )}
                </div>
                <div className={`font-bold line-clamp-1 text-xs text-zinc-800 dark:text-zinc-200 ${reminder.completed ? 'line-through' : ''}`}>
                    {reminder.content || reminder.note?.title || 'No title'}
                </div>
                <div className="text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                    {dayjs(Number(reminder.reminderDate)).format('HH:mm')}
                </div>
            </div>
        </Link>
    );
};
