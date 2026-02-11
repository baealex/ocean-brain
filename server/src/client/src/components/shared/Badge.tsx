import { getRandomBackground } from '~/modules/color';

interface BadgeProps {
    name: string;
}

export default function Badge({ name }: BadgeProps) {
    return (
        <div className={`${getRandomBackground(name)} text-zinc-800 dark:text-zinc-200 text-xs font-bold border border-zinc-700 dark:border-zinc-600 px-2 py-1 rounded-[8px_3px_9px_2px/3px_6px_3px_7px]`}>
            {name}
        </div>
    );
}
