import { priorityColors, overdueColor } from '~/modules/color';

const priorities = [
    {
        label: 'High',
        className: priorityColors.high
    },
    {
        label: 'Medium',
        className: priorityColors.medium
    },
    {
        label: 'Low',
        className: priorityColors.low
    },
    {
        label: 'Overdue',
        className: overdueColor
    }
];

export const PriorityLegend = () => {
    return (
        <div className="flex flex-wrap items-center gap-3 text-xs">
            {priorities.map(({ label, className }) => (
                <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sketchy-xs ${className}`} />
                    <span className="text-fg-tertiary font-medium">
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );
};
