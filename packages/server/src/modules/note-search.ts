export interface NoteSearchQuery {
    included: string[];
    excluded: string[];
    hasFilters: boolean;
}

interface SearchableNoteLike {
    title: string;
    content: string;
    searchableText?: string;
    searchableTextVersion?: number;
}

export interface NoteSearchProjection {
    searchableText: string;
    searchableTextVersion: number;
}

interface SearchProjectionContext {
    segments: string[];
}

type SearchableJsonNode = Record<string, unknown>;
type SearchNodeExtractor = (node: SearchableJsonNode, context: SearchProjectionContext) => void;
type SearchExtractorNodeType = (typeof NOTE_SEARCH_EXTRACTOR_NODE_TYPES)[number];

// If we later materialize searchable text into a DB column, bump this when the
// extraction meaning changes so stored projections can be rebuilt safely.
export const NOTE_SEARCH_TEXT_SCHEMA_VERSION = 1;

const FILE_BLOCK_VISIBLE_PROP_KEYS = ['name', 'caption'] as const;

export const NOTE_SEARCH_EXTRACTOR_NODE_TYPES = [
    'text',
    'tag',
    'reference',
    'image',
    'video',
    'audio',
    'file'
] as const;

export const NOTE_SEARCH_PASS_THROUGH_NODE_TYPES = [
    'link',
    'paragraph',
    'heading',
    'bulletListItem',
    'numberedListItem',
    'checkListItem',
    'toggleListItem',
    'quote',
    'codeBlock',
    'divider',
    'table',
    'tableContent',
    'tableCell'
] as const;

export const NOTE_SEARCH_IGNORED_NODE_TYPES = [
    'tableOfContents'
] as const;

const KNOWN_NOTE_SEARCH_NODE_TYPES = new Set<string>([
    ...NOTE_SEARCH_EXTRACTOR_NODE_TYPES,
    ...NOTE_SEARCH_PASS_THROUGH_NODE_TYPES,
    ...NOTE_SEARCH_IGNORED_NODE_TYPES
]);
const SEARCH_NODE_EXTRACTOR_TYPE_SET = new Set<string>(NOTE_SEARCH_EXTRACTOR_NODE_TYPES);

const unknownNoteSearchNodeTypeCounts = new Map<string, number>();

const SEARCH_NODE_EXTRACTORS: Record<SearchExtractorNodeType, SearchNodeExtractor> = {
    text: (node, context) => {
        pushVisibleSegment(context, node.text);
    },
    tag: (node, context) => {
        pushVisibleProps(context, node.props, ['tag']);
    },
    reference: (node, context) => {
        pushVisibleProps(context, node.props, ['title']);
    },
    image: (node, context) => {
        pushVisibleProps(context, node.props, FILE_BLOCK_VISIBLE_PROP_KEYS);
    },
    video: (node, context) => {
        pushVisibleProps(context, node.props, FILE_BLOCK_VISIBLE_PROP_KEYS);
    },
    audio: (node, context) => {
        pushVisibleProps(context, node.props, FILE_BLOCK_VISIBLE_PROP_KEYS);
    },
    file: (node, context) => {
        pushVisibleProps(context, node.props, FILE_BLOCK_VISIBLE_PROP_KEYS);
    }
};

const recordUnknownNoteSearchNodeType = (type: string) => {
    if (KNOWN_NOTE_SEARCH_NODE_TYPES.has(type)) {
        return;
    }

    const nextCount = (unknownNoteSearchNodeTypeCounts.get(type) ?? 0) + 1;
    unknownNoteSearchNodeTypeCounts.set(type, nextCount);

    if (nextCount === 1) {
        process.emitWarning(
            `note-search encountered unsupported BlockNote node type "${type}". Only nested text will be indexed until explicit support is added.`,
            { code: 'OCEAN_BRAIN_NOTE_SEARCH_UNKNOWN_NODE' }
        );
    }
};

const isSearchExtractorNodeType = (type: string): type is SearchExtractorNodeType => {
    return SEARCH_NODE_EXTRACTOR_TYPE_SET.has(type);
};

const normalizeSearchText = (value: string) => value.replace(/\s+/g, ' ').trim();

const normalizeSearchToken = (value: string) => normalizeSearchText(value).toLowerCase();

const isRecord = (value: unknown): value is SearchableJsonNode => {
    return typeof value === 'object' && value !== null;
};

const pushVisibleSegment = (context: SearchProjectionContext, value: unknown) => {
    if (typeof value !== 'string') {
        return;
    }

    const normalizedValue = normalizeSearchText(value);

    if (!normalizedValue) {
        return;
    }

    context.segments.push(normalizedValue);
};

const pushVisibleProps = (
    context: SearchProjectionContext,
    props: unknown,
    keys: readonly string[]
) => {
    if (!isRecord(props)) {
        return;
    }

    for (const key of keys) {
        pushVisibleSegment(context, props[key]);
    }
};

const collectVisibleSearchSegments = (node: unknown, context: SearchProjectionContext) => {
    if (Array.isArray(node)) {
        node.forEach((item) => collectVisibleSearchSegments(item, context));
        return;
    }

    if (!isRecord(node)) {
        return;
    }

    const type = typeof node.type === 'string' ? node.type : undefined;

    if (type) {
        if (isSearchExtractorNodeType(type)) {
            SEARCH_NODE_EXTRACTORS[type](node, context);
        }

        recordUnknownNoteSearchNodeType(type);
    }

    if ('content' in node) {
        collectVisibleSearchSegments(node.content, context);
    }

    if ('children' in node) {
        collectVisibleSearchSegments(node.children, context);
    }

    if ('rows' in node) {
        collectVisibleSearchSegments(node.rows, context);
    }

    if ('cells' in node) {
        collectVisibleSearchSegments(node.cells, context);
    }
};

export const buildNoteSearchText = (note: Pick<SearchableNoteLike, 'title' | 'content'>) => {
    const normalizedTitle = normalizeSearchText(note.title);
    const normalizedContent = extractVisibleSearchTextFromContent(note.content);

    return normalizeSearchToken(`${normalizedTitle} ${normalizedContent}`);
};

export const buildNoteSearchProjection = (note: Pick<SearchableNoteLike, 'title' | 'content'>): NoteSearchProjection => {
    return {
        searchableText: buildNoteSearchText(note),
        searchableTextVersion: NOTE_SEARCH_TEXT_SCHEMA_VERSION
    };
};

export const parseNoteSearchQuery = (query: string): NoteSearchQuery => {
    const included: string[] = [];
    const excluded: string[] = [];

    for (const item of query.split(/\s+/).map((value) => value.trim()).filter(Boolean)) {
        if (item.startsWith('-') && item.length > 1) {
            excluded.push(normalizeSearchToken(item.slice(1)));
            continue;
        }

        included.push(normalizeSearchToken(item));
    }

    return {
        included,
        excluded,
        hasFilters: included.length > 0 || excluded.length > 0
    };
};

export const extractVisibleSearchTextFromContent = (content: string) => {
    try {
        const parsed = JSON.parse(content) as unknown;
        const context: SearchProjectionContext = { segments: [] };

        collectVisibleSearchSegments(parsed, context);

        return normalizeSearchText(context.segments.join(' '));
    } catch {
        return '';
    }
};

export const matchesNoteSearchQuery = (
    note: SearchableNoteLike,
    query: string | NoteSearchQuery
) => {
    const parsedQuery = typeof query === 'string' ? parseNoteSearchQuery(query) : query;

    if (!parsedQuery.hasFilters) {
        return true;
    }

    const haystack = note.searchableTextVersion === NOTE_SEARCH_TEXT_SCHEMA_VERSION
        && typeof note.searchableText === 'string'
        ? normalizeSearchToken(note.searchableText)
        : buildNoteSearchText(note);

    return parsedQuery.included.every((term) => haystack.includes(term))
        && parsedQuery.excluded.every((term) => !haystack.includes(term));
};

export const filterNotesBySearchQuery = <T extends SearchableNoteLike>(
    notes: T[],
    query: string | NoteSearchQuery
) => {
    const parsedQuery = typeof query === 'string' ? parseNoteSearchQuery(query) : query;

    if (!parsedQuery.hasFilters) {
        return notes;
    }

    return notes.filter((note) => matchesNoteSearchQuery(note, parsedQuery));
};

export const getUnknownNoteSearchNodeTypeCounts = () => {
    return new Map(unknownNoteSearchNodeTypeCounts);
};

export const resetUnknownNoteSearchNodeTypeCountsForTest = () => {
    unknownNoteSearchNodeTypeCounts.clear();
};
