import { markdownToHTML } from '@blocknote/core';

interface BlockNotePasteEditor {
    getTextCursorPosition: () => {
        block: {
            type: string;
        };
    };
    pasteHTML: (html: string) => unknown;
}

interface BlockNotePasteContext {
    event: ClipboardEvent;
    editor: BlockNotePasteEditor;
    defaultPasteHandler: () => boolean | undefined;
}

interface MarkdownClipboardData {
    getData: (type: string) => string;
    setData: (type: string, data: string) => void;
}

const MARKDOWN_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
const MARKDOWN_ANGLE_BRACKET_TOKEN_PATTERN = /<[^<>\n]*>/g;
const TILDE_RUN_PATTERN = /~+/g;
const NUMERIC_ENDPOINT_TOKEN_CHARACTER_PATTERN = /[\p{L}\p{M}\p{N}\p{Sc}%‰.,+\-/:°℃℉µμ·²³^]/u;
const NUMERIC_ENDPOINT_START_PATTERN = /^(?:[+-]?\p{Sc}?|\p{Sc}[+-]?)\p{N}/u;
const NUMERIC_CHARACTER_REFERENCE_PATTERN = /&#(?:x[0-9a-f]+|\d+);/giu;
const SPECIAL_PASTE_TYPES = new Set(['Files', 'blocknote/html', 'vscode-editor-data']);
const NUMERIC_TILDE_RANGE_PLACEHOLDER_PREFIX = '\uE000OBTILDE';
const NUMERIC_TILDE_RANGE_PLACEHOLDER_SUFFIX = '\uE001';

// Keep this aligned with BlockNote's detectMarkdown helper so HTML/plain-text
// clipboard priority remains unchanged when the protected path is needed.
const BLOCKNOTE_NON_TABLE_MARKDOWN_DETECTION_PATTERNS = [
    /(^|\n) {0,3}#{1,6} {1,8}[^\n]{1,64}\r?\n\r?\n\s{0,32}\S/,
    /(_|__|\*|\*\*|~~|==|\+\+)(?!\s)(?:[^\s](?:.{0,62}[^\s])?|\S)(?=\1)/,
    /\[[^\]]{1,128}\]\(https?:\/\/\S{1,999}\)/,
    /(?:\s|^)`(?!\s)(?:[^\s`](?:[^`]{0,46}[^\s`])?|[^\s`])`([^\w]|$)/,
    /(?:^|\n)\s{0,5}-\s{1}[^\n]+\n\s{0,15}-\s/,
    /(?:^|\n)\s{0,5}\d+\.\s{1}[^\n]+\n\s{0,15}\d+\.\s/,
    /\n{2} {0,3}-{2,48}\n{2}/,
    /(?:\n|^)(```|~~~|\$\$)(?!`|~)[^\s]{0,64} {0,64}[^\n]{0,64}\n[\s\S]{0,9999}?\s*\1 {0,64}(?:\n+|$)/,
    /(?:\n|^)(?!\s)\w[^\n]{0,64}\n(-|=)\1{0,64}\n\n\s{0,64}(\w|$)/,
    /(?:^|(\r?\n\r?\n))( {0,3}>[^\n]{1,333}\n){1,999}($|(\r?\n))/,
];

const hasMarkdownTableRow = (markdown: string) => {
    return markdown.split('\n').some((line) => {
        const trimmedLine = line.trim();
        return trimmedLine.length > 2 && trimmedLine.startsWith('|') && trimmedLine.endsWith('|');
    });
};

const matchesBlockNoteMarkdownDetection = (markdown: string) => {
    return (
        BLOCKNOTE_NON_TABLE_MARKDOWN_DETECTION_PATTERNS.some((pattern) => pattern.test(markdown)) ||
        hasMarkdownTableRow(markdown)
    );
};

const splitMarkdownLineEnding = (line: string) => {
    if (line.endsWith('\r\n')) {
        return { body: line.slice(0, -2), ending: '\r\n' };
    }

    if (line.endsWith('\n') || line.endsWith('\r')) {
        return { body: line.slice(0, -1), ending: line.slice(-1) };
    }

    return { body: line, ending: '' };
};

const countRepeatedCharacter = (value: string, start: number, character: string) => {
    let cursor = start;

    while (value[cursor] === character) {
        cursor += 1;
    }

    return cursor - start;
};

const decodeNumericCharacterReference = (reference: string) => {
    const value = reference.slice(2, -1);
    const isHexadecimal = value[0]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(isHexadecimal ? value.slice(1) : value, isHexadecimal ? 16 : 10);

    if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        return reference;
    }

    return String.fromCodePoint(codePoint);
};

const createNumericTildeRangePlaceholder = (markdown: string) => {
    const decodedMarkdown = markdown.replace(NUMERIC_CHARACTER_REFERENCE_PATTERN, decodeNumericCharacterReference);
    const lowercaseMarkdown = markdown.toLowerCase();
    let index = 0;
    let placeholder = `${NUMERIC_TILDE_RANGE_PLACEHOLDER_PREFIX}${index}${NUMERIC_TILDE_RANGE_PLACEHOLDER_SUFFIX}`;

    while (
        markdown.includes(placeholder) ||
        lowercaseMarkdown.includes(encodeURIComponent(placeholder).toLowerCase()) ||
        decodedMarkdown.includes(placeholder)
    ) {
        index += 1;
        placeholder = `${NUMERIC_TILDE_RANGE_PLACEHOLDER_PREFIX}${index}${NUMERIC_TILDE_RANGE_PLACEHOLDER_SUFFIX}`;
    }

    return placeholder;
};

const isPotentialNumericTildeRangeRun = (value: string, start: number, end: number) => {
    if (end - start > 2) {
        return false;
    }

    return hasNumericEndpointBefore(value, start) && hasNumericEndpointAfter(value, end);
};

const findEndpointTokenBefore = (value: string, end: number) => {
    let start = end;

    while (start > 0 && NUMERIC_ENDPOINT_TOKEN_CHARACTER_PATTERN.test(value[start - 1] ?? '')) {
        start -= 1;
    }

    return {
        start,
        token: value.slice(start, end),
    };
};

const findEndpointTokenAfter = (value: string, start: number) => {
    let end = start;

    while (end < value.length && NUMERIC_ENDPOINT_TOKEN_CHARACTER_PATTERN.test(value[end] ?? '')) {
        end += 1;
    }

    return value.slice(start, end);
};

const hasNumericEndpointBefore = (value: string, end: number) => {
    const endpoint = findEndpointTokenBefore(value, end);

    if (NUMERIC_ENDPOINT_START_PATTERN.test(endpoint.token)) {
        return true;
    }

    if (!endpoint.token) {
        return false;
    }

    let previousEnd = endpoint.start;

    while (previousEnd > 0 && (value[previousEnd - 1] === ' ' || value[previousEnd - 1] === '\t')) {
        previousEnd -= 1;
    }

    if (previousEnd === endpoint.start) {
        return false;
    }

    return NUMERIC_ENDPOINT_START_PATTERN.test(findEndpointTokenBefore(value, previousEnd).token);
};

const hasNumericEndpointAfter = (value: string, start: number) => {
    return NUMERIC_ENDPOINT_START_PATTERN.test(findEndpointTokenAfter(value, start));
};

const getNumericTildeRangeRuns = (value: string) => {
    const numericRuns: Array<{ length: number; start: number }> = [];
    const pendingNumericBoundaryStrikeOpeners = new Set<number>();

    for (const match of value.matchAll(TILDE_RUN_PATTERN)) {
        const start = match.index;
        const length = match[0].length;
        const end = start + length;

        if (length > 2) {
            continue;
        }

        const canOpen = end < value.length && !/\s/u.test(value[end] ?? '');
        const canClose = start > 0 && !/\s/u.test(value[start - 1] ?? '');
        const isNumericRange = isPotentialNumericTildeRangeRun(value, start, end);

        if (isNumericRange) {
            // Preserve a valid legacy strike atomically when only its closing
            // delimiter also resembles a numeric range, e.g. 1~deleted 2~3.
            if (canClose && pendingNumericBoundaryStrikeOpeners.delete(length)) {
                continue;
            }

            numericRuns.push({ length, start });
            continue;
        }

        if (canClose && pendingNumericBoundaryStrikeOpeners.delete(length)) {
            continue;
        }

        if (canOpen && hasNumericEndpointBefore(value, start)) {
            pendingNumericBoundaryStrikeOpeners.add(length);
        }
    }

    return numericRuns;
};

const replaceNumericTildeRangeMarkers = (text: string, placeholder: string) => {
    let result = '';
    let cursor = 0;
    const numericRunStarts = new Set(getNumericTildeRangeRuns(text).map((run) => run.start));

    for (const match of text.matchAll(TILDE_RUN_PATTERN)) {
        const start = match.index;
        const end = start + match[0].length;
        result += text.slice(cursor, start);
        result += numericRunStarts.has(start) ? placeholder.repeat(match[0].length) : match[0];
        cursor = end;
    }

    return result + text.slice(cursor);
};

const shouldKeepAngleBracketTokenUnchanged = (token: string) => {
    const innerText = token.slice(1, -1);
    const isAutolink =
        /^[a-z][a-z0-9.+-]{1,31}:[^\s<>]*$/i.test(innerText) || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(innerText);
    const isHtmlTag = /^<\/?[a-z][\w:-]*(?:\s[^<>]*)?\/?\s*>$/i.test(token) || /^<![^<>]*>$/.test(token);

    return isAutolink || isHtmlTag;
};

const protectNumericTildeRanges = (markdown: string, placeholder: string) => {
    let result = '';
    let cursor = 0;

    for (const match of markdown.matchAll(MARKDOWN_ANGLE_BRACKET_TOKEN_PATTERN)) {
        const matchStart = match.index;
        result += replaceNumericTildeRangeMarkers(markdown.slice(cursor, matchStart), placeholder);
        result += shouldKeepAngleBracketTokenUnchanged(match[0])
            ? match[0]
            : replaceNumericTildeRangeMarkers(match[0], placeholder);
        cursor = matchStart + match[0].length;
    }

    return result + replaceNumericTildeRangeMarkers(markdown.slice(cursor), placeholder);
};

const hasNumericTildeRangeMarkers = (markdown: string) => {
    return getNumericTildeRangeRuns(markdown).length > 0;
};

export const markdownToHTMLWithLiteralNumericRanges = (markdown: string) => {
    if (!hasNumericTildeRangeMarkers(markdown)) {
        return markdownToHTML(markdown);
    }

    const placeholder = createNumericTildeRangePlaceholder(markdown);
    const protectedMarkdown = protectNumericTildeRanges(markdown, placeholder);
    const encodedPlaceholder = encodeURIComponent(placeholder);

    return markdownToHTML(protectedMarkdown).split(placeholder).join('~').split(encodedPlaceholder).join('~');
};

const isEscapedMarkdownCharacter = (value: string, index: number) => {
    let precedingBackslashes = 0;

    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
        precedingBackslashes += 1;
    }

    return precedingBackslashes % 2 === 1;
};

const findMatchingBacktickRunEnd = (line: string, start: number, delimiterLength: number) => {
    let cursor = start + delimiterLength;

    while (cursor < line.length) {
        const candidate = line.indexOf('`', cursor);

        if (candidate === -1) {
            return null;
        }

        const candidateLength = countRepeatedCharacter(line, candidate, '`');

        if (candidateLength === delimiterLength) {
            return candidate + candidateLength;
        }

        cursor = candidate + candidateLength;
    }

    return null;
};

const findNextInlineCodeSpan = (line: string, cursor: number) => {
    let codeStart = line.indexOf('`', cursor);

    while (codeStart !== -1) {
        const delimiterLength = countRepeatedCharacter(line, codeStart, '`');

        if (!isEscapedMarkdownCharacter(line, codeStart)) {
            const end = findMatchingBacktickRunEnd(line, codeStart, delimiterLength);

            if (end !== null) {
                return { start: codeStart, end };
            }
        }

        codeStart = line.indexOf('`', codeStart + delimiterLength);
    }

    return null;
};

const transformMarkdownLineOutsideInlineCode = (line: string, transform: (text: string) => string) => {
    let result = '';
    let cursor = 0;

    while (cursor < line.length) {
        const codeSpan = findNextInlineCodeSpan(line, cursor);

        if (!codeSpan) {
            result += transform(line.slice(cursor));
            break;
        }

        result += transform(line.slice(cursor, codeSpan.start));
        result += line.slice(codeSpan.start, codeSpan.end);
        cursor = codeSpan.end;
    }

    return result;
};

const transformSerializedMarkdownText = (markdown: string, transform: (text: string) => string) => {
    let activeFence: { length: number; marker: '`' | '~' } | null = null;

    return markdown
        .split(/(?<=\n)/)
        .map((line) => {
            const { body, ending } = splitMarkdownLineEnding(line);

            if (activeFence) {
                const closingFencePattern = new RegExp(`^ {0,3}${activeFence.marker}{${activeFence.length},} *$`);

                if (closingFencePattern.test(body)) {
                    activeFence = null;
                }

                return line;
            }

            const openingFence = body.match(MARKDOWN_FENCE_PATTERN)?.[1];

            if (openingFence) {
                activeFence = {
                    marker: openingFence[0] as '`' | '~',
                    length: openingFence.length,
                };
                return line;
            }

            return `${transformMarkdownLineOutsideInlineCode(body, transform)}${ending}`;
        })
        .join('');
};

const findMarkdownLinkDestinationEnd = (markdown: string, destinationStart: number) => {
    let parenthesisDepth = 0;

    for (let cursor = destinationStart; cursor < markdown.length; cursor += 1) {
        const character = markdown[cursor];

        if (character === '\\') {
            cursor += 1;
            continue;
        }

        if (character === '(') {
            parenthesisDepth += 1;
            continue;
        }

        if (character !== ')') {
            continue;
        }

        if (parenthesisDepth > 0) {
            parenthesisDepth -= 1;
            continue;
        }

        return cursor;
    }

    return null;
};

const normalizeLinkDestinations = (markdown: string) => {
    let result = '';
    let cursor = 0;

    while (cursor < markdown.length) {
        const destinationPrefix = markdown.indexOf('](', cursor);

        if (destinationPrefix === -1) {
            result += markdown.slice(cursor);
            break;
        }

        const destinationStart = destinationPrefix + 2;
        const destinationEnd = findMarkdownLinkDestinationEnd(markdown, destinationStart);

        if (destinationEnd === null) {
            result += markdown.slice(cursor);
            break;
        }

        result += markdown.slice(cursor, destinationStart);
        result += markdown.slice(destinationStart, destinationEnd).split('\\&').join('&');
        result += ')';
        cursor = destinationEnd + 1;
    }

    return result;
};

const hasMatchingAttentionDelimiterBefore = (source: string, boundary: number) => {
    const marker = source[boundary - 1];

    if (marker !== '*' && marker !== '_') {
        return false;
    }

    let delimiterStart = boundary - 1;

    while (delimiterStart > 0 && source[delimiterStart - 1] === marker) {
        delimiterStart -= 1;
    }

    const delimiter = source.slice(delimiterStart, boundary);
    const openingDelimiter = source.lastIndexOf(delimiter, delimiterStart - 1);

    return openingDelimiter !== -1 && openingDelimiter + delimiter.length < delimiterStart;
};

const hasMatchingAttentionDelimiterAfter = (source: string, boundary: number) => {
    const marker = source[boundary];

    if (marker !== '*' && marker !== '_') {
        return false;
    }

    let delimiterEnd = boundary + 1;

    while (delimiterEnd < source.length && source[delimiterEnd] === marker) {
        delimiterEnd += 1;
    }

    const delimiter = source.slice(boundary, delimiterEnd);
    const closingDelimiter = source.indexOf(delimiter, delimiterEnd);

    return closingDelimiter !== -1 && delimiterEnd < closingDelimiter;
};

const isGeneratedAttentionBoundary = (source: string, offset: number, referenceLength: number) => {
    return (
        hasMatchingAttentionDelimiterBefore(source, offset) ||
        hasMatchingAttentionDelimiterAfter(source, offset + referenceLength)
    );
};

export const formatBlockNoteMarkdownForClipboard = (markdown: string) => {
    return transformSerializedMarkdownText(markdown, (text) => {
        const readableReferences = text.replace(
            NUMERIC_CHARACTER_REFERENCE_PATTERN,
            (reference, offset: number, source: string) => {
                return isGeneratedAttentionBoundary(source, offset, reference.length)
                    ? decodeNumericCharacterReference(reference)
                    : reference;
            },
        );

        return normalizeLinkDestinations(readableReferences);
    });
};

export const formatBlockNoteMarkdownForExport = (markdown: string) => {
    return transformSerializedMarkdownText(markdown, normalizeLinkDestinations);
};

export const normalizeBlockNoteCopy = (clipboardData: MarkdownClipboardData) => {
    const canonicalMarkdown = clipboardData.getData('text/plain');

    if (!canonicalMarkdown) {
        return;
    }

    clipboardData.setData('text/markdown', canonicalMarkdown);
    clipboardData.setData('text/plain', formatBlockNoteMarkdownForClipboard(canonicalMarkdown));
};

export const handleBlockNotePaste = ({ event, editor, defaultPasteHandler }: BlockNotePasteContext) => {
    const clipboardData = event.clipboardData;

    if (!clipboardData || editor.getTextCursorPosition().block.type === 'codeBlock') {
        return defaultPasteHandler();
    }

    const types = Array.from(clipboardData.types);

    if (types.some((type) => SPECIAL_PASTE_TYPES.has(type))) {
        return defaultPasteHandler();
    }

    const hasMarkdown = types.includes('text/markdown');
    const markdown = clipboardData.getData(hasMarkdown ? 'text/markdown' : 'text/plain');

    if (!markdown || !hasNumericTildeRangeMarkers(markdown)) {
        return defaultPasteHandler();
    }

    if (!hasMarkdown && types.includes('text/html') && !matchesBlockNoteMarkdownDetection(markdown)) {
        return defaultPasteHandler();
    }

    editor.pasteHTML(markdownToHTMLWithLiteralNumericRanges(markdown));
    return true;
};
