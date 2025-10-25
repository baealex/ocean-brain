interface BadgeProps {
    name: string;
}

export default function Badge({ name }: BadgeProps) {
    return (
        <div className="bg-white text-black dark:bg-zinc-700 dark:text-zinc-200 text-xs shadow-md rounded-full px-2 py-1">
            {name}
        </div>
    );
}
