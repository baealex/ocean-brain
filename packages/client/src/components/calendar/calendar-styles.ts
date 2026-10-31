interface CalendarCellState {
    isCurrentMonth: boolean;
    isSelected: boolean;
}

interface CalendarDayNumberState {
    isCurrentMonth: boolean;
    isSunday: boolean;
    isToday: boolean;
}

export const getCalendarCellClassName = ({ isCurrentMonth, isSelected }: CalendarCellState) => {
    if (!isCurrentMonth) {
        return 'border-transparent bg-transparent text-fg-disabled hover:bg-hover-subtle';
    }
    if (isSelected) {
        return 'border-border-focus bg-elevated shadow-[0_0_0_1px_var(--border-focus)]';
    }
    return 'border-border-subtle bg-surface hover:border-border-secondary';
};

export const getCalendarDayNumberClassName = ({ isCurrentMonth, isSunday, isToday }: CalendarDayNumberState) => {
    if (isToday) {
        return 'bg-cta font-semibold text-fg-on-filled';
    }
    if (!isCurrentMonth) {
        return 'font-medium text-fg-tertiary';
    }
    return isSunday ? 'font-semibold text-fg-weekend' : 'font-semibold text-fg-secondary';
};
