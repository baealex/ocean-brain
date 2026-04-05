interface SurfaceCardProps {
    children: React.ReactNode;
    className?: string;
}

export default function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
    return (
        <div className={`surface-base ${className}`.trim()}>
            {children}
        </div>
    );
}
