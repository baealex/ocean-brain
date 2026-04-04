interface BadgeProps {
    name: string;
}

export default function Badge({ name }: BadgeProps) {
    return (
        <div className="inline-flex items-center rounded-full border border-border-subtle bg-hover-subtle px-2.5 py-1 text-[0.75rem] font-medium text-fg-secondary">
            {name}
        </div>
    );
}
