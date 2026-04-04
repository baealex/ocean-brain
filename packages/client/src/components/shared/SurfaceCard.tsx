interface SurfaceCardProps {
    children: React.ReactNode;
    className?: string;
}

export default function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
    return (
        <div className={`surface-base rounded-[18px] border border-border-subtle ${className}`.trim()}>
            {children}
        </div>
    );
}
