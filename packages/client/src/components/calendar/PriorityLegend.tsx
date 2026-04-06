import { priorityColorsSubtle } from '~/modules/color';

const priorities = [
    {
        label: 'High',
        className: priorityColorsSubtle.high
    },
    {
        label: 'Medium',
        className: priorityColorsSubtle.medium
    },
    {
        label: 'Low',
        className: priorityColorsSubtle.low
    },
    {
        label: 'Overdue',
        className: 'bg-accent-soft-danger/70 dark:bg-emphasis/70'
    }
];

export const PriorityLegend = () => {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {priorities.map(({ label, className }) => (
                <div key={label} className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded-full border border-border-subtle ${className}`} />
                    <span className="text-label font-medium text-fg-tertiary">
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );
};
