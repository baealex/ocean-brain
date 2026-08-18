import type { ReactNode } from 'react';
import { Text } from '~/components/ui';

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface CalendarGridProps {
    children: ReactNode;
    isLoading: boolean;
    className?: string;
    ariaLabel?: string;
}

export const CalendarGrid = ({
    children,
    isLoading,
    className = '',
    ariaLabel = 'Month overview',
}: CalendarGridProps) => (
    <section aria-label={ariaLabel} aria-busy={isLoading} className={`min-w-0 ${className}`}>
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
                    {children}
                </div>
            </div>
        </div>
    </section>
);
