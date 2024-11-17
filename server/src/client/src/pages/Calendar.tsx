import dayjs from 'dayjs';
import { useQuery } from 'react-query';
import { Link, useSearchParams } from 'react-router-dom';
import * as Icon from '~/components/icon';
import type { Note } from '~/models/Note';
import { getRandomBackground } from '~/modules/color';
import { graphQuery } from '~/modules/graph-query';
import { getNoteURL } from '~/modules/url';
import { useTheme } from '~/store/theme';

export default function Calendar() {
    const [searchParams, setSearchParams] = useSearchParams();

    const { theme } = useTheme(state => state);

    const year = Number(searchParams.get('year')) || dayjs().year();
    const month = Number(searchParams.get('month')) || dayjs().month() + 1;
    const type = searchParams.get('type') || 'create';

    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WEB', 'THU', 'FRI', 'SAT'];
    const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const calendarDays = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
        calendarDays.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
        calendarDays.push(day);
    }

    const lastDayOfWeek = (firstDayOfWeek + totalDays) % 7;
    const daysToFill = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;

    for (let i = 0; i < daysToFill; i++) {
        calendarDays.push(null);
    }

    const handlePrevMonth = () => {
        if (month === 1) {
            setSearchParams((searchParams) => {
                searchParams.set('month', '12');
                searchParams.set('year', (year - 1).toString());
                return searchParams;
            });
        } else {
            setSearchParams((searchParams) => {
                searchParams.set('month', (month - 1).toString());
                return searchParams;
            });
        }
    };

    const handleNextMonth = () => {
        if (month === 12) {
            setSearchParams((searchParams) => {
                searchParams.set('month', '1');
                searchParams.set('year', (year + 1).toString());
                return searchParams;
            });
        } else {
            setSearchParams((searchParams) => {
                searchParams.set('month', (month + 1).toString());
                return searchParams;
            });
        }
    };

    const { data } = useQuery(['notesInDateRange', year, month], async () => {
        const { notesInDateRange } = await graphQuery<{
            notesInDateRange: Note[];
        }>(
            `query def(
                $dateRange: DateRangeInput,
            ) {
                notesInDateRange(dateRange: $dateRange) {
                    id
                    title
                    createdAt
                    updatedAt
                }
            }`,
            {
                dateRange: {
                    start: `${year}-${month}-01`,
                    end: `${year}-${month}-${totalDays}`
                }
            }
        );
        return notesInDateRange;
    });

    const border = theme === 'light' ? '1px solid #d5d5d5' : '1px solid #363636';

    return (
        <div>
            <div className="flex justify-center">
                <div className="flex max-w-full w-56 items-center justify-between font-semibold mt-8 mb-10">
                    <button onClick={handlePrevMonth}>
                        <Icon.ChevronLeft width={24} />
                    </button>
                    <h2 className="text-lg">{`${months[month - 1]} ${year}`}</h2>
                    <button onClick={handleNextMonth}>
                        <Icon.ChevronRight width={24} />
                    </button>
                </div>
            </div>
            <div
                style={{
                    width: '100%',
                    overflowX: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)'
                }}>
                {daysOfWeek.map((day) => (
                    <div key={day} className={`flex justify-center font-bold mb-2 ${day === 'SUN' && 'text-rose-600 dark:text-rose-700'}`}>
                        {day}
                    </div>
                ))}
                {calendarDays.map((day, index) => (
                    <div
                        key={index}
                        style={{
                            minHeight: '160px',
                            minWidth: '152px',
                            borderTop: border,
                            borderLeft: border,
                            borderRight: (index + 1) % 7 === 0 ? border : undefined,
                            borderBottom: index + 7 >= calendarDays.length ? border : undefined
                        }}>
                        <div className={`flex justify-end mt-4 mr-4 mb-2 ${index % 7 === 0 && 'text-rose-600 dark:text-rose-700'}`}>
                            {day !== null ? day : ''}
                        </div>
                        <div className="flex flex-col">
                            {data?.filter(note => {
                                const date = type === 'create'
                                    ? dayjs(Number(note.createdAt))
                                    : dayjs(Number(note.updatedAt));
                                return date.date() === day && date.year() === year && date.month() + 1 === month;
                            })?.map(note => (
                                <Link to={getNoteURL(note.id)}>
                                    <div className={`${getRandomBackground(note.title)} text-sm rounded-lg mx-2 mb-2 p-2 flex flex-col gap-1`}>
                                        <div>
                                            {note.title}
                                        </div>
                                        <div className="text-gray-600">
                                            {dayjs(type === 'create' ? Number(note.createdAt) : Number(note.updatedAt)).format('HH:ss')}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-end items-center gap-1 mt-4">
                <span>
                    Display notes by:
                </span>
                <button
                    className="bg-black text-white rounded-lg px-2"
                    onClick={() => {
                        setSearchParams((searchParams) => {
                            if (searchParams.get('type') !== 'update') {
                                searchParams.set('type', 'update');
                            } else {
                                searchParams.delete('type');
                            }
                            return searchParams;
                        });
                    }}>
                    {type}
                </button>
            </div>
        </div>
    );
}
