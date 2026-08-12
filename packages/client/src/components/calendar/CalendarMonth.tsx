import { useEffect, useMemo, useState } from 'react';

import { Modal } from '~/components/ui';
import { CalendarDay } from './CalendarDay';
import { CalendarDayDetail, getCalendarDayHeading } from './CalendarDayDetail';
import { CalendarGrid } from './CalendarGrid';
import type { CalendarDayData, CalendarDisplayType } from './types';

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
                <CalendarGrid isLoading={isLoading} className="xl:pr-5">
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
                </CalendarGrid>

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
