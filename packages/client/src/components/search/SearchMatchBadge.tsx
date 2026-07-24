import type { SearchNoteMatch } from '~/apis/search.api';
import { Text } from '~/components/ui';

interface SearchMatchBadgeProps {
    match?: SearchNoteMatch;
}

const getLabel = (match?: SearchNoteMatch) => {
    if (match?.lexical && match.semantic) return 'Keyword + meaning';
    if (match?.semantic) return 'Meaning match';
    if (match?.lexical) return 'Keyword match';
    return null;
};

const SearchMatchBadge = ({ match }: SearchMatchBadgeProps) => {
    const label = getLabel(match);
    if (!label) return null;

    return (
        <Text
            as="span"
            variant="micro"
            weight="semibold"
            tone="tertiary"
            className="shrink-0 rounded-full bg-muted px-2 py-1"
        >
            {label}
        </Text>
    );
};

export default SearchMatchBadge;
