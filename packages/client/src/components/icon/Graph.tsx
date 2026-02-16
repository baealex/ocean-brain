export function Graph(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}>
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="18" r="3" />
            <circle cx="12" cy="12" r="3" />
            <line x1="8.5" y1="7.5" x2="10" y2="10" />
            <line x1="15.5" y1="7.5" x2="14" y2="10" />
            <line x1="8.5" y1="16.5" x2="10" y2="14" />
            <line x1="15.5" y1="16.5" x2="14" y2="14" />
        </svg>
    );
}
