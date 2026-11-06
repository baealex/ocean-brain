export interface EmbeddingInputFormat {
    /** Wraps the search query. Must contain `{query}`. */
    queryTemplate: string;
    /** Wraps each note chunk when the note has a title. Must contain `{content}`; `{title}` is optional. */
    documentTemplate: string;
    /** Appended to every query and note chunk, for example an end-of-text token some servers do not add. */
    inputSuffix: string;
}

export type DocumentInputFormat = Pick<EmbeddingInputFormat, 'documentTemplate' | 'inputSuffix'>;
export type QueryInputFormat = Pick<EmbeddingInputFormat, 'queryTemplate' | 'inputSuffix'>;

export const DEFAULT_EMBEDDING_INPUT_FORMAT: EmbeddingInputFormat = {
    queryTemplate: '{query}',
    documentTemplate: 'Title: {title}\nContent: {content}',
    inputSuffix: '',
};

const PLACEHOLDER_PATTERN = /\{(query|title|content)\}/g;

type PlaceholderValues = Partial<Record<'query' | 'title' | 'content', string>>;

// Replace every placeholder in one pass so a title or query that contains `{content}` is not expanded again.
const fillTemplate = (template: string, values: PlaceholderValues) =>
    template.replace(PLACEHOLDER_PATTERN, (placeholder, key: keyof PlaceholderValues) => values[key] ?? placeholder);

export const renderQueryInput = (format: QueryInputFormat, query: string) => {
    return `${fillTemplate(format.queryTemplate, { query })}${format.inputSuffix}`;
};

/** Notes without a title are embedded as their content only, whatever the template. */
export const renderDocumentInput = (format: DocumentInputFormat, title: string, content: string) => {
    const text = title ? fillTemplate(format.documentTemplate, { title, content }).trimEnd() : content;
    return `${text}${format.inputSuffix}`;
};
