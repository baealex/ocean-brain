import { cva, type VariantProps } from 'class-variance-authority';

const surfaceCardVariants = cva('surface-base', {
    variants: {
        tone: {
            default: '',
            elevated: 'surface-elevated',
        },
        padding: {
            default: 'p-4',
            compact: 'px-3 py-2.5',
            roomy: 'p-6',
            flush: 'overflow-hidden',
        },
    },
    defaultVariants: {
        tone: 'default',
        padding: 'default',
    },
});

interface SurfaceCardProps extends VariantProps<typeof surfaceCardVariants> {
    children: React.ReactNode;
    className?: string;
    flush?: boolean;
}

export default function SurfaceCard({
    children,
    className,
    flush = false,
    padding = 'default',
    tone = 'default',
}: SurfaceCardProps) {
    const resolvedPadding = flush ? 'flush' : padding;

    return (
        <div
            className={surfaceCardVariants({
                tone,
                padding: resolvedPadding,
                className,
            })}
        >
            {children}
        </div>
    );
}
