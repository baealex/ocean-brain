import dayjs from 'dayjs';
import { useQuery } from 'react-query';
import { Link, useSearchParams } from 'react-router-dom';
import * as Icon from '~/components/icon';
import type { Note } from '~/models/Note';
import { getRandomBackground } from '~/modules/color';
import { graphQuery } from '~/modules/graph-query';
import { getNoteURL } from '~/modules/url';

export default function Calendar() {
    const [searchParams, setSearchParams] = useSearchParams();

    const year = Number(searchParams.get('year')) || dayjs().year();
    const month = Number(searchParams.get('month')) || dayjs().month() + 1;

    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WEB', 'THU', 'FRI', 'SAT'];

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

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    margin: '16px'
                }}>
                <button onClick={handlePrevMonth}>
                    <Icon.ChevronLeft width={24} />
                </button>
                <h2 className="text-lg">{`${year}년 ${month}월`}</h2>
                <button onClick={handleNextMonth}>
                    <Icon.ChevronRight width={24} />
                </button>
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)'
                }}>
                {daysOfWeek.map((day) => (
                    <div
                        key={day}
                        style={{
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                        {day}
                    </div>
                ))}
                {calendarDays.map((day, index) => (
                    <div
                        key={index}
                        style={{
                            minHeight: '120px',
                            borderTop: '1px solid #ccc',
                            borderLeft: '1px solid #ccc',
                            borderRight: (index + 1) % 7 === 0 ? '1px solid #ccc' : undefined,
                            borderBottom: index + 7 >= calendarDays.length ? '1px solid #ccc' : undefined,
                            padding: '12px'
                        }}>
                        <div className="flex justify-end">
                            {day !== null ? day : ''}
                        </div>
                        {data?.filter(note => {
                            const date = dayjs(Number(note.createdAt));
                            return date.date() === day && date.year() === year && date.month() + 1 === month;
                        })?.map(note => (
                            <Link to={getNoteURL(note.id)}>
                                <div className={`${getRandomBackground(note.title)} text-sm line-clamp-1 rounded-lg px-2 my-2`}>
                                    {note.title}
                                </div>
                            </Link>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
