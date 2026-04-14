import { Fragment } from 'react';

interface HighlightProps {
    children: string;
    match: string;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const Highlight = ({ children, match }: HighlightProps) => {
    const normalizedMatch = match.trim();

    if (!normalizedMatch) {
        return <span>{children}</span>;
    }

    const escapedMatch = escapeRegExp(normalizedMatch);
    const splitRegex = new RegExp(`(${escapedMatch})`, 'gi');
    const exactMatchRegex = new RegExp(`^${escapedMatch}$`, 'i');
    const parts = children.split(splitRegex);

    return (
        <span>
            {parts.map((part, index) =>
                exactMatchRegex.test(part) ? <mark key={index}>{part}</mark> : <Fragment key={index}>{part}</Fragment>,
            )}
        </span>
    );
};

export default Highlight;
