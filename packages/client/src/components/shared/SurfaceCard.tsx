interface SurfaceCardProps {
    children: React.ReactNode;
    className?: string;
    flush?: boolean;
}

export default function SurfaceCard({ children, className = '', flush = false }: SurfaceCardProps) {
    const base = flush ? 'overflow-hidden' : 'p-4';
    return (
        <div className={`surface-base ${base}${className ? ` ${className}` : ''}`}>
            {children}
        </div>
    );
}
