interface BadgeProps {
    name: string;
}

export default function Badge({ name }: BadgeProps) {
    return (
        <div className="text-label inline-flex items-center rounded-full border border-border-subtle bg-hover-subtle px-2.5 py-1 font-medium text-fg-secondary">
            {name}
        </div>
    );
}
