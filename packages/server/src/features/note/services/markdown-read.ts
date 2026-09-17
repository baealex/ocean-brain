export interface MarkdownReadInput {
    offset?: number;
    maxLength?: number;
    heading?: string;
    expectedUpdatedAt?: string;
}

// Offsets use JavaScript UTF-16 indices. Do not split a surrogate pair at a page boundary.
const boundary = (text: string, index: number) =>
    index > 0 && /[\uDC00-\uDFFF]/.test(text[index] ?? '') && /[\uD800-\uDBFF]/.test(text[index - 1])
        ? index - 1
        : index;

const headingsIn = (markdown: string) => {
    const headings: Array<{ heading: string; level: number; start: number; end: number }> = [];
    let fence: { character: string; length: number } | null = null;
    for (const line of markdown.matchAll(/^.*(?:\n|$)/gm)) {
        if (!line[0]) continue;
        const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line[0]);
        if (fenceMatch) {
            const marker = fenceMatch[1];
            if (!fence) fence = { character: marker[0], length: marker.length };
            else if (
                marker[0] === fence.character &&
                marker.length >= fence.length &&
                line[0].slice(fenceMatch[0].length).trim() === ''
            )
                fence = null;
            continue;
        }
        if (fence) continue;
        const heading = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*(?:\r?\n)?$/.exec(line[0]);
        if (heading)
            headings.push({
                heading: heading[2].replace(/[ \t]+#+[ \t]*$/, '').trim(),
                level: heading[1].length,
                start: line.index,
                end: markdown.length,
            });
    }
    return headings.map((heading, index) => ({
        ...heading,
        end: headings.slice(index + 1).find((next) => next.level <= heading.level)?.start ?? markdown.length,
    }));
};

export const readMarkdownRange = (markdown: string, updatedAt: Date, input: MarkdownReadInput) => {
    const maxLength = input.maxLength ?? 1000;
    const offset = input.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(maxLength) || maxLength < 0) {
        throw new Error('offset and maxLength must be nonnegative integers.');
    }
    if (input.heading !== undefined && input.offset !== undefined)
        throw new Error('Use either heading or offset, not both.');
    const empty = { markdown: '', contentRange: null, candidates: [] };
    if (input.expectedUpdatedAt !== undefined) {
        const expected = /^\d+$/.test(input.expectedUpdatedAt)
            ? Number(input.expectedUpdatedAt)
            : Date.parse(input.expectedUpdatedAt);
        if (expected !== updatedAt.getTime())
            return {
                ...empty,
                status: 'failed',
                reason: 'NOTE_VERSION_CONFLICT',
                message: 'The note changed. Start a new read using its current updatedAt.',
            };
    }
    let start = boundary(markdown, Math.min(offset, markdown.length));
    let sectionEnd = markdown.length;
    if (input.heading !== undefined) {
        const candidates = headingsIn(markdown).filter((heading) => heading.heading === input.heading);
        if (candidates.length !== 1)
            return {
                ...empty,
                status: candidates.length ? 'needs_disambiguation' : 'failed',
                reason: candidates.length ? 'HEADING_AMBIGUOUS' : 'HEADING_NOT_FOUND',
                message: candidates.length
                    ? 'Use a candidate start as offset to select a heading.'
                    : 'Exact heading text was not found.',
                candidates,
            };
        start = candidates[0].start;
        sectionEnd = candidates[0].end;
    }
    let end = maxLength === 0 ? sectionEnd : boundary(markdown, Math.min(start + maxLength, sectionEnd));
    // A one-unit page at an astral character still advances by the full character.
    if (end === start && start < sectionEnd) end = Math.min(start + 2, sectionEnd);
    const hasMore = end < sectionEnd;
    return {
        status: 'read',
        reason: null,
        message: null,
        candidates: [],
        markdown: markdown.slice(start, end),
        contentRange: {
            start,
            end,
            totalLength: markdown.length,
            sectionEnd,
            hasMore,
            nextOffset: hasMore ? end : null,
        },
    };
};
