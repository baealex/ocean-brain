import { useEffect, useMemo, useState } from 'react';

import { Modal, Text } from '~/components/ui';
import { CalendarDay } from './CalendarDay';
import { CalendarDayDetail, getCalendarDayHeading } from './CalendarDayDetail';
import type { CalendarDayData, CalendarDisplayType } from './types';

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DESKTOP_CALENDAR_QUERY = '(min-width: 1280px)';

interface CalendarMonthProps {
    days: CalendarDayData[];
    type: CalendarDisplayType;
    isLoading: boolean;
    selectedDayKey?: string;
    onSelectedDayChange: (dayKey: string) => void;
}

export const CalendarMonth = ({ days, type, isLoading, selectedDayKey, onSelectedDayChange }: CalendarMonthProps) => {
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
    const selectedDay = useMemo(() => days.find((day) => day.key === selectedDayKey), [days, selectedDayKey]);

    useEffect(() => {
        const mediaQuery = window.matchMedia(DESKTOP_CALENDAR_QUERY);
        const handleBreakpointChange = (event: MediaQueryListEvent) => {
            if (event.matches) setIsMobileDetailOpen(false);
        };

        mediaQuery.addEventListener('change', handleBreakpointChange);
        return () => mediaQuery.removeEventListener('change', handleBreakpointChange);
    }, []);

    const handleDaySelect = (dayKey: string) => {
        onSelectedDayChange(dayKey);
        if (!window.matchMedia(DESKTOP_CALENDAR_QUERY).matches) {
            setIsMobileDetailOpen(true);
        }
    };

    const modalTitle = selectedDay ? getCalendarDayHeading(selectedDay) : 'Day details';

    return (
        <>
            <div className="min-w-0 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section aria-label="Month overview" aria-busy={isLoading} className="min-w-0 xl:pr-5">
                    <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="min-w-[19rem]">
                            <div className="mb-2 grid grid-cols-7 gap-px">
                                {DAYS_OF_WEEK.map((day, index) => (
                                    <Text
                                        key={day}
                                        as="div"
                                        variant="label"
                                        weight="semibold"
                                        tracking="wider"
                                        transform="uppercase"
                                        className={`py-1.5 text-center ${index === 0 ? 'text-fg-weekend' : 'text-fg-secondary'}`}
                                    >
                                        <span aria-hidden="true" className="sm:hidden">
                                            {day.slice(0, 1)}
                                        </span>
                                        <span className="hidden sm:inline">{day}</span>
                                    </Text>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[12px] border border-border-subtle/80 bg-border-subtle/70">
                                {days.map((day) => (
                                    <CalendarDay
                                        key={day.key}
                                        year={day.year}
                                        month={day.month}
                                        day={day.day}
                                        isCurrentMonth={day.isCurrentMonth}
                                        isSunday={day.isSunday}
                                        isToday={day.isToday}
                                        isSelected={day.key === selectedDayKey}
                                        isPast={day.isPast}
                                        notes={day.notes}
                                        reminders={day.reminders}
                                        onSelect={() => handleDaySelect(day.key)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <aside
                    className="relative hidden min-h-0 border-l border-border-subtle xl:block"
                    aria-label="Selected day"
                >
                    <div className="absolute inset-y-0 right-0 left-5">
                        <CalendarDayDetail day={selectedDay} type={type} isLoading={isLoading} />
                    </div>
                </aside>
            </div>

            <Modal
                isOpen={isMobileDetailOpen && Boolean(selectedDay)}
                onClose={() => setIsMobileDetailOpen(false)}
                variant="inspect"
                className="xl:hidden"
            >
                <Modal.Header title={modalTitle} onClose={() => setIsMobileDetailOpen(false)} />
                <Modal.Body>
                    <Modal.Description className="sr-only">
                        View notes and reminders for {modalTitle}.
                    </Modal.Description>
                    <CalendarDayDetail day={selectedDay} type={type} isLoading={isLoading} presentation="modal" />
                </Modal.Body>
            </Modal>
        </>
    );
};
