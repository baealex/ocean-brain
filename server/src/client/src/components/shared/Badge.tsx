import { getRandomBackground } from '~/modules/color';

interface BadgeProps {
    name: string;
}

export default function Badge({ name }: BadgeProps) {
    return (
        <div className={`${getRandomBackground(name)} text-fg-default text-xs font-bold border border-border-secondary px-2 py-1 rounded-[8px_3px_9px_2px/3px_6px_3px_7px]`}>
            {name}
        </div>
    );
}
