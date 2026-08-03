import type { SearchNoteMatch } from '~/apis/search.api';
import { Text } from '~/components/ui';

interface SearchMatchBadgeProps {
    match?: SearchNoteMatch;
    className?: string;
}

const getLabel = (match?: SearchNoteMatch) => {
    if (match?.lexical && match.semantic) return 'Keyword + Meaning';
    if (match?.semantic) return 'Meaning match';
    if (match?.lexical) return 'Keyword match';
    return null;
};

const SearchMatchBadge = ({ match, className }: SearchMatchBadgeProps) => {
    const label = getLabel(match);
    if (!label) return null;

    return (
        <Text
            as="span"
            variant="meta"
            weight="semibold"
            tone="tertiary"
            className={`shrink-0 rounded-full bg-muted px-2 py-1 ${className ?? ''}`.trim()}
        >
            {label}
        </Text>
    );
};

export default SearchMatchBadge;
