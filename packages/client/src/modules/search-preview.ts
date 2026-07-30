const MAX_SEARCH_SNIPPET_LENGTH = 180;

const normalizeSearchText = (value: string) => value.replace(/\s+/g, ' ').trim();

const getNormalizedSearchTerms = (query: string) => normalizeSearchText(query).toLowerCase().split(' ').filter(Boolean);

const buildSearchExcerpt = (text: string, query: string) => {
    const normalizedText = normalizeSearchText(text);
    const normalizedQuery = normalizeSearchText(query).toLowerCase();

    if (!normalizedQuery) {
        return normalizedText;
    }

    const lowerText = normalizedText.toLowerCase();
    let matchedText = normalizedQuery;
    let matchIndex = lowerText.indexOf(normalizedQuery);

    if (matchIndex === -1) {
        const fallbackMatch = getNormalizedSearchTerms(query)
            .map((term) => ({ term, index: lowerText.indexOf(term) }))
            .filter((match) => match.index >= 0)
            .sort((left, right) => left.index - right.index || right.term.length - left.term.length)[0];

        if (fallbackMatch) {
            matchedText = fallbackMatch.term;
            matchIndex = fallbackMatch.index;
        }
    }

    if (matchIndex === -1) {
        return normalizedText.length > MAX_SEARCH_SNIPPET_LENGTH
            ? `${normalizedText.slice(0, MAX_SEARCH_SNIPPET_LENGTH - 1).trimEnd()}…`
            : normalizedText;
    }

    const excerptStart = Math.max(0, matchIndex - 56);
    const excerptEnd = Math.min(normalizedText.length, matchIndex + matchedText.length + 84);

    let snippet = normalizedText.slice(excerptStart, excerptEnd).trim();

    if (excerptStart > 0) {
        snippet = `…${snippet}`;
    }

    if (excerptEnd < normalizedText.length) {
        snippet = `${snippet}…`;
    }

    return snippet;
};

const getInlineText = (content: unknown) => {
    if (!Array.isArray(content)) {
        return '';
    }

    return content
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return '';
            }

            const text = (item as { text?: unknown }).text;
            return typeof text === 'string' ? text : '';
        })
        .join('');
};

export type SearchPreviewKind = 'heading' | 'list' | 'checklist' | 'quote' | 'code' | 'content';

const getBlockKind = (type?: string): SearchPreviewKind => {
    if (type === 'heading') return 'heading';
    if (type === 'bulletListItem' || type === 'numberedListItem') return 'list';
    if (type === 'checkListItem') return 'checklist';
    if (type === 'quote') return 'quote';
    if (type === 'codeBlock') return 'code';

    return 'content';
};

export interface SearchPreviewBlock {
    kind: SearchPreviewKind;
    text: string;
}

const collectPreviewBlocks = (nodes: unknown, blocks: SearchPreviewBlock[]) => {
    if (!Array.isArray(nodes)) {
        return;
    }

    nodes.forEach((node) => {
        if (!node || typeof node !== 'object') {
            return;
        }

        const type =
            typeof (node as { type?: unknown }).type === 'string' ? (node as { type: string }).type : undefined;
        const text = normalizeSearchText(getInlineText((node as { content?: unknown }).content));

        if (text) {
            blocks.push({
                kind: getBlockKind(type),
                text,
            });
        }

        const children = (node as { children?: unknown }).children;
        if (Array.isArray(children)) {
            collectPreviewBlocks(children, blocks);
        }
    });
};

export const getSearchPreviewBlocks = (content: string, query: string) => {
    try {
        const parsed = JSON.parse(content) as unknown;
        const blocks: SearchPreviewBlock[] = [];

        collectPreviewBlocks(parsed, blocks);

        if (blocks.length === 0) {
            return [];
        }

        const normalizedTerms = getNormalizedSearchTerms(query);
        const matchingBlocks =
            normalizedTerms.length > 0
                ? blocks.filter((block) => normalizedTerms.some((term) => block.text.toLowerCase().includes(term)))
                : blocks;
        const selectedBlocks = (matchingBlocks.length > 0 ? matchingBlocks : blocks).slice(0, 2);

        return selectedBlocks.map((block) => ({
            ...block,
            text: buildSearchExcerpt(block.text, query),
        }));
    } catch {
        return [];
    }
};
