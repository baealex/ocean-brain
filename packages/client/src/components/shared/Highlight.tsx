interface HighlightProps {
    children: string;
    match: string;
}

const Highlight = ({ children, match }: HighlightProps) => {
    if (!match) {
        return <span>{children}</span>;
    }

    const regex = new RegExp(`(${match})`, 'gi');
    const parts = children.split(regex);

    return (
        <span>
            {parts.map((part, index) =>
                regex.test(part) ? <mark key={index}>{part}</mark> : part
            )}
        </span>
    );
};

export default Highlight;
