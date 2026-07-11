import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { ensureTagByName } from '~/features/tag/services/organization.js';
import models from '~/models.js';

interface BlockNote {
    id?: string;
    type: string;
    props?: Record<string, unknown>;
    content?: BlockNoteContent;
    children?: BlockNote[];
    text?: string;
    styles?: Record<string, unknown>;
}

interface BlockNoteInline {
    type: string;
    props?: Record<string, unknown>;
    text?: string;
    styles?: Record<string, unknown>;
}

interface BlockNoteTableCell {
    type: 'tableCell';
    props?: Record<string, unknown>;
    content?: BlockNoteInline[];
}

interface BlockNoteTableRow {
    cells?: BlockNoteTableCell[];
}

interface BlockNoteTableContent {
    type: 'tableContent';
    columnWidths?: Array<number | null>;
    headerRows?: number;
    rows?: BlockNoteTableRow[];
}

type BlockNoteContent = BlockNoteInline[] | BlockNoteTableContent;

interface MarkdownImportDeps {
    ensureTag: (name: string) => Promise<
        | {
              id: string;
              name: string;
          }
        | {
              tag: {
                  id: string;
                  name: string;
              };
          }
    >;
    findNotesByTitle: (title: string) => Promise<
        Array<{
            id: string;
            title: string;
        }>
    >;
    findNoteById?: (id: string) => Promise<{
        id: string;
        title: string;
    } | null>;
}

const UNSUPPORTED_MARKDOWN_BLOCK_TYPES = new Set(['tableOfContents']);
const TAG_PLACEHOLDER_PREFIX = 'OCEAN_BRAIN_TAG_';
const TAG_PLACEHOLDER_SUFFIX = '_TOKEN';
const REFERENCE_PLACEHOLDER_PREFIX = 'OCEAN_BRAIN_REFERENCE_';
const REFERENCE_PLACEHOLDER_SUFFIX = '_TOKEN';

const defaultMarkdownImportDeps: MarkdownImportDeps = {
    ensureTag: async (name) => ensureTagByName(name),
    findNotesByTitle: async (title) => {
        const notes = await models.note.findMany({
            select: {
                id: true,
                title: true,
            },
            where: { title },
            orderBy: { createdAt: 'asc' },
            take: 2,
        });

        return notes.map((note) => ({
            id: String(note.id),
            title: note.title,
        }));
    },
    findNoteById: async (id) => {
        if (!isValidNoteIdString(id)) {
            return null;
        }

        const numericId = Number(id);

        const note = await models.note.findUnique({
            select: {
                id: true,
                title: true,
            },
            where: { id: numericId },
        });

        return note
            ? {
                  id: String(note.id),
                  title: note.title,
              }
            : null;
    },
};

function stripUnsupportedMarkdownBlocks(blocks: BlockNote[]): BlockNote[] {
    return blocks
        .filter((block) => !UNSUPPORTED_MARKDOWN_BLOCK_TYPES.has(block.type))
        .map((block) => ({
            ...block,
            children: block.children?.length ? stripUnsupportedMarkdownBlocks(block.children) : [],
        }));
}

function parseBlockNoteContent(contentJson: string): BlockNote[] {
    const parsed = JSON.parse(contentJson);

    if (!Array.isArray(parsed)) {
        throw new Error('INVALID_BLOCKNOTE_CONTENT');
    }

    return parsed;
}

function visitBlocks(blocks: BlockNote[], visit: (block: BlockNote) => void) {
    for (const block of blocks) {
        visit(block);

        if (block.children?.length) {
            visitBlocks(block.children, visit);
        }
    }
}

function createTagPlaceholder(index: number) {
    return `${TAG_PLACEHOLDER_PREFIX}${index}${TAG_PLACEHOLDER_SUFFIX}`;
}

function createReferencePlaceholder(index: number) {
    return `${REFERENCE_PLACEHOLDER_PREFIX}${index}${REFERENCE_PLACEHOLDER_SUFFIX}`;
}

function isValidNoteIdString(id: string) {
    if (!/^[1-9]\d*$/.test(id)) {
        return false;
    }

    const numericId = Number(id);

    return Number.isSafeInteger(numericId) && numericId <= MAX_SQLITE_INT_ID;
}

function isTableContent(content: BlockNoteContent | undefined): content is BlockNoteTableContent {
    return !Array.isArray(content) && content?.type === 'tableContent';
}

function mapBlockContent(
    content: BlockNoteContent | undefined,
    mapInline: (inline: BlockNoteInline) => BlockNoteInline,
): BlockNoteContent | undefined {
    if (Array.isArray(content)) {
        return content.map(mapInline);
    }

    if (!isTableContent(content)) {
        return content;
    }

    return {
        ...content,
        rows: content.rows?.map((row) => ({
            ...row,
            cells: row.cells?.map((cell) => ({
                ...cell,
                content: cell.content?.map(mapInline),
            })),
        })),
    };
}

async function mapBlockContentAsync(
    content: BlockNoteContent | undefined,
    mapInline: (inline: BlockNoteInline) => Promise<BlockNoteInline[]>,
): Promise<BlockNoteContent | undefined> {
    if (Array.isArray(content)) {
        return (await Promise.all(content.map(mapInline))).flat();
    }

    if (!isTableContent(content)) {
        return content;
    }

    return {
        ...content,
        rows: await Promise.all(
            (content.rows ?? []).map(async (row) => ({
                ...row,
                cells: await Promise.all(
                    (row.cells ?? []).map(async (cell) => ({
                        ...cell,
                        content: cell.content ? (await Promise.all(cell.content.map(mapInline))).flat() : cell.content,
                    })),
                ),
            })),
        ),
    };
}

function visitBlockContent(content: BlockNoteContent | undefined, visitInline: (inline: BlockNoteInline) => void) {
    if (Array.isArray(content)) {
        for (const inline of content) {
            visitInline(inline);
        }
        return;
    }

    if (!isTableContent(content)) {
        return;
    }

    for (const row of content.rows ?? []) {
        for (const cell of row.cells ?? []) {
            for (const inline of cell.content ?? []) {
                visitInline(inline);
            }
        }
    }
}

function mapBlocks(
    blocks: BlockNote[],
    mapContent: (content: BlockNoteContent | undefined) => BlockNoteContent | undefined,
): BlockNote[] {
    return blocks.map((block) => ({
        ...block,
        content: mapContent(block.content),
        children: block.children?.length ? mapBlocks(block.children, mapContent) : [],
    }));
}

function preprocessCustomInlineContent(
    blocks: BlockNote[],
    placeholderToTag: Map<string, string>,
    nextPlaceholderIndex: { value: number },
): BlockNote[] {
    return mapBlocks(blocks, (content) =>
        mapBlockContent(content, (inline) => {
            if (inline.type === 'reference') {
                const id = String(inline.props?.id || '');
                const title = String(inline.props?.title || inline.props?.id || '');

                return {
                    type: 'text',
                    text: isValidNoteIdString(id) ? `[[${title}]](note:${id})` : `[[${title}]]`,
                    styles: {},
                };
            }
            if (inline.type === 'tag') {
                const tag = (inline.props?.tag as string) || '';
                const placeholder = createTagPlaceholder(nextPlaceholderIndex.value++);
                placeholderToTag.set(placeholder, tag);
                return {
                    type: 'text',
                    text: placeholder,
                    styles: {},
                };
            }
            return inline;
        }),
    );
}

function restoreTagPlaceholdersInMarkdown(markdown: string, placeholderToTag: Map<string, string>) {
    let restoredMarkdown = markdown;

    for (const [placeholder, tag] of placeholderToTag.entries()) {
        restoredMarkdown = restoredMarkdown.split(placeholder).join(`[${tag}]`);
    }

    return restoredMarkdown;
}

function preprocessMarkdownExplicitTags(markdown: string) {
    const placeholderToTag = new Map<string, string>();
    let nextPlaceholderIndex = 0;
    const preprocessedMarkdown = markdown.replace(/\[([@#][^\s[\]]+)\]/g, (_match, tagToken: string) => {
        const placeholder = createTagPlaceholder(nextPlaceholderIndex++);
        placeholderToTag.set(placeholder, tagToken);
        return placeholder;
    });

    return {
        markdown: preprocessedMarkdown,
        placeholderToTag,
    };
}

function preprocessMarkdownExplicitReferences(markdown: string) {
    const placeholderToReference = new Map<string, { id: string; title: string; token: string }>();
    let activeFence: { marker: '`' | '~'; length: number } | null = null;

    const preprocessedLines = markdown.split(/(?<=\n)/).map((line) => {
        const { body: lineBody, lineEnding } = splitMarkdownLineEnding(line);
        const fenceMatch = lineBody.match(MARKDOWN_FENCED_CODE_PATTERN);

        if (activeFence) {
            if (isClosingFenceLine(lineBody, activeFence)) {
                activeFence = null;
            }

            return line;
        }

        if (fenceMatch?.[1]) {
            activeFence = {
                marker: fenceMatch[1][0] as '`' | '~',
                length: fenceMatch[1].length,
            };
            return line;
        }

        if (/^(?: {4,}|\t)/.test(lineBody)) {
            return line;
        }

        return `${replaceMarkdownLineExplicitReferences(lineBody, placeholderToReference)}${lineEnding}`;
    });

    return {
        markdown: preprocessedLines.join(''),
        placeholderToReference,
    };
}

function replaceMarkdownLineExplicitReferences(
    line: string,
    placeholderToReference: Map<string, { id: string; title: string; token: string }>,
) {
    let result = '';
    let cursor = 0;

    while (cursor < line.length) {
        const codeSpan = findNextInlineCodeSpan(line, cursor);

        if (!codeSpan) {
            result += replaceExplicitReferenceTokens(line.slice(cursor), placeholderToReference);
            break;
        }

        result += replaceExplicitReferenceTokens(line.slice(cursor, codeSpan.start), placeholderToReference);
        result += line.slice(codeSpan.start, codeSpan.end);
        cursor = codeSpan.end;
    }

    return result;
}

function replaceExplicitReferenceTokens(
    text: string,
    placeholderToReference: Map<string, { id: string; title: string; token: string }>,
) {
    return text.replace(/\[\[([^\n]+?)\]\]\(note:([^)\s]+)\)/g, (token, title: string, id: string) => {
        const placeholder = createReferencePlaceholder(placeholderToReference.size);
        placeholderToReference.set(placeholder, { id, title, token });
        return placeholder;
    });
}

const MARKDOWN_ANGLE_BRACKET_TOKEN_PATTERN = /<([^<>\n]+)>/g;
const MARKDOWN_NUMERIC_TILDE_RANGE_PATTERN = /(\d)~(?=\d)/g;
const MARKDOWN_FENCED_CODE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
const ANGLE_BRACKET_PLACEHOLDER_PREFIX = '\uE000OBANGLE';
const ANGLE_BRACKET_PLACEHOLDER_SUFFIX = '\uE001';
const NUMERIC_TILDE_RANGE_PLACEHOLDER_PREFIX = '\uE000OBTILDE';
const NUMERIC_TILDE_RANGE_PLACEHOLDER_SUFFIX = '\uE001';
const HARD_BREAK_PLACEHOLDER_PREFIX = '\uE000OBHARDBREAK';
const HARD_BREAK_PLACEHOLDER_SUFFIX = '\uE001';
const MAX_SQLITE_INT_ID = 2_147_483_647;

function isMarkdownAutolinkAngleBracketText(innerText: string) {
    if (innerText !== innerText.trim()) {
        return false;
    }

    return /^[a-z][a-z0-9.+-]{1,31}:[^\s<>]*$/i.test(innerText) || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(innerText);
}

function countLiteralAngleBracketTextTokens(markdown: string) {
    const tokenCounts = new Map<string, number>();

    for (const match of markdown.matchAll(MARKDOWN_ANGLE_BRACKET_TOKEN_PATTERN)) {
        const token = match[0];
        const innerText = match[1] ?? '';

        if (!token || isMarkdownAutolinkAngleBracketText(innerText)) {
            continue;
        }

        tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }

    return tokenCounts;
}

export function extractLiteralAngleBracketTextTokens(markdown: string) {
    return [...countLiteralAngleBracketTextTokens(markdown).keys()];
}

export function hasLiteralAngleBracketTextTokenLoss(sourceMarkdown: string, renderedMarkdown: string) {
    const sourceCounts = countLiteralAngleBracketTextTokens(sourceMarkdown);

    if (sourceCounts.size === 0) {
        return false;
    }

    const renderedCounts = countLiteralAngleBracketTextTokens(renderedMarkdown);

    for (const [token, sourceCount] of sourceCounts) {
        if ((renderedCounts.get(token) ?? 0) < sourceCount) {
            return true;
        }
    }

    return false;
}

function countNumericTildeRangeMarkers(markdown: string) {
    return [...markdown.matchAll(MARKDOWN_NUMERIC_TILDE_RANGE_PATTERN)].length;
}

export function hasNumericTildeRangeMarkers(markdown: string) {
    return countNumericTildeRangeMarkers(markdown) > 0;
}

export function hasNumericTildeRangeMarkerLoss(sourceMarkdown: string, renderedMarkdown: string) {
    const sourceCount = countNumericTildeRangeMarkers(sourceMarkdown);

    return sourceCount > 0 && countNumericTildeRangeMarkers(renderedMarkdown) < sourceCount;
}

function protectMarkdownNumericTildeRanges(markdown: string) {
    const protectedLines: string[] = [];
    const placeholderToToken = new Map<string, string>();
    let activeFence: { marker: '`' | '~'; length: number } | null = null;

    for (const line of markdown.split(/(?<=\n)/)) {
        const { body: lineBody, lineEnding } = splitMarkdownLineEnding(line);
        const fenceMatch = lineBody.match(MARKDOWN_FENCED_CODE_PATTERN);

        if (activeFence) {
            protectedLines.push(line);

            if (isClosingFenceLine(lineBody, activeFence)) {
                activeFence = null;
            }

            continue;
        }

        if (fenceMatch?.[1]) {
            const marker = fenceMatch[1][0] as '`' | '~';
            activeFence = {
                marker,
                length: fenceMatch[1].length,
            };
            protectedLines.push(line);
            continue;
        }

        if (/^(?: {4,}|\t)/.test(lineBody)) {
            protectedLines.push(line);
            continue;
        }

        protectedLines.push(`${protectMarkdownLineNumericTildeRanges(lineBody, placeholderToToken)}${lineEnding}`);
    }

    return {
        markdown: protectedLines.join(''),
        placeholderToToken,
    };
}

function protectMarkdownLineEndHardBreakMarkers(markdown: string) {
    const protectedLines: string[] = [];
    const placeholderToToken = new Map<string, string>();
    let activeFence: { marker: '`' | '~'; length: number } | null = null;
    const lines = markdown.split(/(?<=\n)/);

    for (const [index, line] of lines.entries()) {
        const { body: lineBody, lineEnding } = splitMarkdownLineEnding(line);
        const fenceMatch = lineBody.match(MARKDOWN_FENCED_CODE_PATTERN);

        if (activeFence) {
            protectedLines.push(line);

            if (isClosingFenceLine(lineBody, activeFence)) {
                activeFence = null;
            }

            continue;
        }

        if (fenceMatch?.[1]) {
            const marker = fenceMatch[1][0] as '`' | '~';
            activeFence = {
                marker,
                length: fenceMatch[1].length,
            };
            protectedLines.push(line);
            continue;
        }

        if (/^(?: {4,}|\t)/.test(lineBody)) {
            protectedLines.push(line);
            continue;
        }

        const nextLineBody = splitMarkdownLineEnding(lines[index + 1] ?? '').body;
        protectedLines.push(
            `${protectMarkdownLineEndHardBreakMarker(
                lineBody,
                lineEnding,
                isMarkdownHardBreakContinuationLine(nextLineBody),
                placeholderToToken,
            )}${lineEnding}`,
        );
    }

    return {
        markdown: protectedLines.join(''),
        placeholderToToken,
    };
}

function protectMarkdownTextAngleBrackets(markdown: string) {
    const protectedLines: string[] = [];
    const placeholderToToken = new Map<string, string>();
    let activeFence: { marker: '`' | '~'; length: number } | null = null;

    for (const line of markdown.split(/(?<=\n)/)) {
        const { body: lineBody, lineEnding } = splitMarkdownLineEnding(line);
        const fenceMatch = lineBody.match(MARKDOWN_FENCED_CODE_PATTERN);

        if (activeFence) {
            protectedLines.push(line);

            if (isClosingFenceLine(lineBody, activeFence)) {
                activeFence = null;
            }

            continue;
        }

        if (fenceMatch?.[1]) {
            const marker = fenceMatch[1][0] as '`' | '~';
            activeFence = {
                marker,
                length: fenceMatch[1].length,
            };
            protectedLines.push(line);
            continue;
        }

        if (/^(?: {4,}|\t)/.test(lineBody)) {
            protectedLines.push(line);
            continue;
        }

        protectedLines.push(`${protectMarkdownLineTextAngleBrackets(lineBody, placeholderToToken)}${lineEnding}`);
    }

    return {
        markdown: protectedLines.join(''),
        placeholderToToken,
    };
}

function splitMarkdownLineEnding(line: string) {
    if (line.endsWith('\r\n')) {
        return {
            body: line.slice(0, -2),
            lineEnding: '\r\n',
        };
    }

    if (line.endsWith('\n')) {
        return {
            body: line.slice(0, -1),
            lineEnding: '\n',
        };
    }

    return {
        body: line,
        lineEnding: '',
    };
}

function isClosingFenceLine(line: string, fence: { marker: '`' | '~'; length: number }) {
    const escapedMarker = fence.marker === '`' ? '`' : '~';
    return new RegExp(`^ {0,3}${escapedMarker}{${fence.length},} *$`).test(line);
}

function protectMarkdownLineTextAngleBrackets(line: string, placeholderToToken: Map<string, string>) {
    let result = '';
    let cursor = 0;

    while (cursor < line.length) {
        const codeStart = line.indexOf('`', cursor);

        if (codeStart === -1) {
            result += replaceLiteralAngleBracketTextTokens(line.slice(cursor), placeholderToToken);
            break;
        }

        result += replaceLiteralAngleBracketTextTokens(line.slice(cursor, codeStart), placeholderToToken);

        const delimiterLength = countRepeatedCharacter(line, codeStart, '`');
        const codeEnd = line.indexOf('`'.repeat(delimiterLength), codeStart + delimiterLength);

        if (codeEnd === -1) {
            result += replaceLiteralAngleBracketTextTokens(line.slice(codeStart), placeholderToToken);
            break;
        }

        const codeEndExclusive = codeEnd + delimiterLength;
        result += line.slice(codeStart, codeEndExclusive);
        cursor = codeEndExclusive;
    }

    return result;
}

function protectMarkdownLineNumericTildeRanges(line: string, placeholderToToken: Map<string, string>) {
    let result = '';
    let cursor = 0;

    while (cursor < line.length) {
        const protectedSpan = findNextMarkdownProtectedSpan(line, cursor);

        if (!protectedSpan) {
            result += replaceNumericTildeRangeMarkers(line.slice(cursor), placeholderToToken);
            break;
        }

        result += replaceNumericTildeRangeMarkers(line.slice(cursor, protectedSpan.start), placeholderToToken);
        result += line.slice(protectedSpan.start, protectedSpan.end);
        cursor = protectedSpan.end;
    }

    return result;
}

function findNextMarkdownProtectedSpan(line: string, cursor: number) {
    const codeSpan = findNextInlineCodeSpan(line, cursor);
    const linkDestinationSpan = findNextMarkdownLinkDestinationSpan(line, cursor);

    if (!codeSpan) {
        return linkDestinationSpan;
    }

    if (!linkDestinationSpan) {
        return codeSpan;
    }

    return codeSpan.start <= linkDestinationSpan.start ? codeSpan : linkDestinationSpan;
}

function findNextInlineCodeSpan(line: string, cursor: number) {
    const codeStart = line.indexOf('`', cursor);

    if (codeStart === -1) {
        return null;
    }

    const delimiterLength = countRepeatedCharacter(line, codeStart, '`');
    const codeEnd = line.indexOf('`'.repeat(delimiterLength), codeStart + delimiterLength);

    if (codeEnd === -1) {
        return null;
    }

    return {
        start: codeStart,
        end: codeEnd + delimiterLength,
    };
}

function findNextMarkdownLinkDestinationSpan(line: string, cursor: number) {
    const linkDestinationPrefix = line.indexOf('](', cursor);

    if (linkDestinationPrefix === -1) {
        return null;
    }

    const destinationStart = linkDestinationPrefix + 2;
    const destinationEnd = line.indexOf(')', destinationStart);

    if (destinationEnd === -1) {
        return null;
    }

    return {
        start: destinationStart,
        end: destinationEnd,
    };
}

function replaceLiteralAngleBracketTextTokens(text: string, placeholderToToken: Map<string, string>) {
    return text.replace(MARKDOWN_ANGLE_BRACKET_TOKEN_PATTERN, (match, innerText: string) => {
        if (isMarkdownAutolinkAngleBracketText(innerText)) {
            return match;
        }

        const placeholder = createAngleBracketPlaceholder(placeholderToToken.size);
        placeholderToToken.set(placeholder, match);

        return placeholder;
    });
}

function replaceNumericTildeRangeMarkers(text: string, placeholderToToken: Map<string, string>) {
    return text.replace(MARKDOWN_NUMERIC_TILDE_RANGE_PATTERN, (match, leadingDigit: string) => {
        const placeholder = createNumericTildeRangePlaceholder(placeholderToToken.size);
        placeholderToToken.set(placeholder, '~');

        return `${leadingDigit}${placeholder}`;
    });
}

function protectMarkdownLineEndHardBreakMarker(
    line: string,
    lineEnding: string,
    hasContinuationLine: boolean,
    placeholderToToken: Map<string, string>,
) {
    if (!lineEnding || !line.endsWith('\\')) {
        return line;
    }

    const placeholder = createHardBreakPlaceholder(placeholderToToken.size);
    const shouldPreserveAsHardBreak = hasContinuationLine && !hasUnclosedInlineCodeSpanAtLineEnd(line);
    placeholderToToken.set(placeholder, shouldPreserveAsHardBreak ? '\n' : '\\');

    return `${line.slice(0, -1)}${placeholder}`;
}

function isMarkdownHardBreakContinuationLine(line: string) {
    if (!line.trim()) {
        return false;
    }

    const trimmedLine = line.trimStart();

    if (trimmedLine.match(MARKDOWN_FENCED_CODE_PATTERN)) {
        return false;
    }

    if (/^(?:#{1,6})(?:\s|$)/.test(trimmedLine)) {
        return false;
    }

    if (/^>/.test(trimmedLine)) {
        return false;
    }

    if (/^(?:[-+*])(?:\s|$)/.test(trimmedLine) || /^\d{1,9}[.)](?:\s|$)/.test(trimmedLine)) {
        return false;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(trimmedLine)) {
        return false;
    }

    return true;
}

function hasUnclosedInlineCodeSpanAtLineEnd(line: string) {
    let cursor = 0;
    let openDelimiter: string | null = null;

    while (cursor < line.length) {
        const codeStart = line.indexOf('`', cursor);

        if (codeStart === -1) {
            break;
        }

        const delimiterLength = countRepeatedCharacter(line, codeStart, '`');
        const delimiter = '`'.repeat(delimiterLength);
        openDelimiter = openDelimiter === delimiter ? null : delimiter;
        cursor = codeStart + delimiterLength;
    }

    return openDelimiter !== null;
}

function createAngleBracketPlaceholder(index: number) {
    return `${ANGLE_BRACKET_PLACEHOLDER_PREFIX}${index}${ANGLE_BRACKET_PLACEHOLDER_SUFFIX}`;
}

function createNumericTildeRangePlaceholder(index: number) {
    return `${NUMERIC_TILDE_RANGE_PLACEHOLDER_PREFIX}${index}${NUMERIC_TILDE_RANGE_PLACEHOLDER_SUFFIX}`;
}

function createHardBreakPlaceholder(index: number) {
    return `${HARD_BREAK_PLACEHOLDER_PREFIX}${index}${HARD_BREAK_PLACEHOLDER_SUFFIX}`;
}

function countRepeatedCharacter(value: string, start: number, character: string) {
    let cursor = start;

    while (value[cursor] === character) {
        cursor += 1;
    }

    return cursor - start;
}

function findTagPlaceholderAtCursor(text: string, cursor: number, placeholderToTag: Map<string, string>) {
    for (const [placeholder, tagToken] of placeholderToTag.entries()) {
        if (text.startsWith(placeholder, cursor)) {
            return {
                placeholder,
                tagToken,
            };
        }
    }

    return null;
}

function findReferencePlaceholderAtCursor(
    text: string,
    cursor: number,
    placeholderToReference: Map<string, { id: string; title: string; token: string }>,
) {
    for (const [placeholder, reference] of placeholderToReference.entries()) {
        if (text.startsWith(placeholder, cursor)) {
            return {
                placeholder,
                reference,
            };
        }
    }

    return null;
}

function restoreRemainingTagPlaceholders(blocks: BlockNote[], placeholderToTag: Map<string, string>): BlockNote[] {
    return mapBlocks(blocks, (content) =>
        mapBlockContent(content, (inline) => {
            if (inline.type !== 'text' || typeof inline.text !== 'string') {
                return inline;
            }

            let text = inline.text;

            for (const [placeholder, tagToken] of placeholderToTag.entries()) {
                text = text.split(placeholder).join(`[${tagToken}]`);
            }

            return {
                ...inline,
                text,
            };
        }),
    );
}

function restoreProtectedTextPlaceholders(blocks: BlockNote[], placeholderToToken: Map<string, string>): BlockNote[] {
    if (placeholderToToken.size === 0) {
        return blocks;
    }

    return mapBlocks(blocks, (content) =>
        mapBlockContent(
            content,
            (inline) => restoreProtectedTextInValue(inline, placeholderToToken) as BlockNoteInline,
        ),
    );
}

function restoreProtectedTextInValue(value: unknown, placeholderToToken: Map<string, string>): unknown {
    if (typeof value === 'string') {
        return restoreProtectedText(value, placeholderToToken);
    }

    if (Array.isArray(value)) {
        return value.map((item) => restoreProtectedTextInValue(item, placeholderToToken));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, restoreProtectedTextInValue(item, placeholderToToken)]),
        );
    }

    return value;
}

function restoreProtectedText(text: string, placeholderToToken: Map<string, string>) {
    let restoredText = text;

    for (const [placeholder, token] of placeholderToToken.entries()) {
        if (placeholder.startsWith(HARD_BREAK_PLACEHOLDER_PREFIX) && token === '\n') {
            restoredText = restoredText
                .split(`${placeholder} `)
                .join(placeholder)
                .split(`${placeholder}\n `)
                .join(`${placeholder}\n`)
                .split(`${placeholder}\r\n `)
                .join(`${placeholder}\r\n`);
        }

        restoredText = restoredText.split(placeholder).join(token);
    }

    return restoredText;
}

function createTextInline(text: string, styles: Record<string, unknown> = {}): BlockNoteInline {
    return {
        type: 'text',
        text,
        styles,
    };
}

function appendInline(target: BlockNoteInline[], inline: BlockNoteInline) {
    const previous = target.at(-1);

    if (
        previous?.type === 'text' &&
        inline.type === 'text' &&
        previous.text !== undefined &&
        inline.text !== undefined &&
        JSON.stringify(previous.styles ?? {}) === JSON.stringify(inline.styles ?? {})
    ) {
        previous.text += inline.text;
        return;
    }

    target.push(inline);
}

async function restoreCustomInlineContent(
    blocks: BlockNote[],
    deps: MarkdownImportDeps,
    placeholderToTag: Map<string, string>,
    placeholderToReference: Map<string, { id: string; title: string; token: string }> = new Map(),
): Promise<BlockNote[]> {
    const tagCache = new Map<string, Promise<{ id: string; tag: string }>>();
    const noteCache = new Map<string, Promise<Array<{ id: string; title: string }>>>();
    const noteByIdCache = new Map<string, Promise<{ id: string; title: string } | null>>();

    const getTag = (token: string) => {
        const normalizedToken = token.startsWith('#') ? `@${token.slice(1)}` : token;
        let existing = tagCache.get(normalizedToken);

        if (!existing) {
            existing = deps.ensureTag(normalizedToken.slice(1)).then((result) => ({
                id: 'tag' in result ? result.tag.id : result.id,
                tag: 'tag' in result ? result.tag.name : result.name,
            }));
            tagCache.set(normalizedToken, existing);
        }

        return existing;
    };

    const getNotesByTitle = (title: string) => {
        let existing = noteCache.get(title);

        if (!existing) {
            existing = deps.findNotesByTitle(title);
            noteCache.set(title, existing);
        }

        return existing;
    };

    const getNoteById = (id: string) => {
        let existing = noteByIdCache.get(id);

        if (!existing) {
            existing = deps.findNoteById ? deps.findNoteById(id) : Promise.resolve(null);
            noteByIdCache.set(id, existing);
        }

        return existing;
    };

    const restoreTextInline = async (inline: BlockNoteInline): Promise<BlockNoteInline[]> => {
        if (inline.type !== 'text' || typeof inline.text !== 'string' || !inline.text || inline.styles?.code === true) {
            return [inline];
        }

        const restored: BlockNoteInline[] = [];
        const styles = inline.styles ?? {};
        let cursor = 0;

        while (cursor < inline.text.length) {
            const referencePlaceholderMatch = findReferencePlaceholderAtCursor(
                inline.text,
                cursor,
                placeholderToReference,
            );

            if (referencePlaceholderMatch) {
                if (!isValidNoteIdString(referencePlaceholderMatch.reference.id)) {
                    appendInline(restored, createTextInline(referencePlaceholderMatch.reference.token, styles));
                    cursor += referencePlaceholderMatch.placeholder.length;
                    continue;
                }

                const note = await getNoteById(referencePlaceholderMatch.reference.id);

                if (note) {
                    appendInline(restored, {
                        type: 'reference',
                        props: {
                            id: note.id,
                            title: note.title,
                        },
                    });
                } else {
                    appendInline(restored, createTextInline(referencePlaceholderMatch.reference.token, styles));
                }

                cursor += referencePlaceholderMatch.placeholder.length;
                continue;
            }

            if (inline.text.startsWith('[[', cursor)) {
                const closeIndex = inline.text.indexOf(']]', cursor + 2);

                if (closeIndex !== -1) {
                    const title = inline.text.slice(cursor + 2, closeIndex);
                    const matchingNotes = await getNotesByTitle(title);

                    if (matchingNotes.length === 1) {
                        appendInline(restored, {
                            type: 'reference',
                            props: {
                                id: matchingNotes[0].id,
                                title: matchingNotes[0].title,
                            },
                        });
                        cursor = closeIndex + 2;
                        continue;
                    }
                }
            }

            const tagPlaceholderMatch = findTagPlaceholderAtCursor(inline.text, cursor, placeholderToTag);

            if (tagPlaceholderMatch) {
                const tag = await getTag(tagPlaceholderMatch.tagToken);
                appendInline(restored, {
                    type: 'tag',
                    props: tag,
                });
                cursor += tagPlaceholderMatch.placeholder.length;
                continue;
            }

            let nextCursor = inline.text.length;

            const nextReferenceCursor = inline.text.indexOf('[[', cursor + 1);

            if (nextReferenceCursor !== -1) {
                nextCursor = Math.min(nextCursor, nextReferenceCursor);
            }

            for (const placeholder of placeholderToTag.keys()) {
                const nextPlaceholderCursor = inline.text.indexOf(placeholder, cursor + 1);

                if (nextPlaceholderCursor !== -1) {
                    nextCursor = Math.min(nextCursor, nextPlaceholderCursor);
                }
            }

            for (const placeholder of placeholderToReference.keys()) {
                const nextPlaceholderCursor = inline.text.indexOf(placeholder, cursor + 1);

                if (nextPlaceholderCursor !== -1) {
                    nextCursor = Math.min(nextCursor, nextPlaceholderCursor);
                }
            }

            appendInline(restored, createTextInline(inline.text.slice(cursor, nextCursor), styles));
            cursor = nextCursor;
        }

        return restored;
    };

    const restoreBlocks = async (items: BlockNote[]): Promise<BlockNote[]> => {
        return Promise.all(
            items.map(async (block) => {
                if (block.type === 'codeBlock') {
                    return {
                        ...block,
                        children: block.children?.length ? await restoreBlocks(block.children) : [],
                    };
                }

                return {
                    ...block,
                    content: await mapBlockContentAsync(block.content, restoreTextInline),
                    children: block.children?.length ? await restoreBlocks(block.children) : [],
                };
            }),
        );
    };

    return restoreBlocks(blocks);
}

function collectTagIds(blocks: BlockNote[]): string[] {
    const tagIds = new Set<string>();

    const visit = (items: BlockNote[]) => {
        for (const block of items) {
            visitBlockContent(block.content, (inline) => {
                if (inline.type === 'tag' && typeof inline.props?.id === 'string') {
                    tagIds.add(inline.props.id);
                }
            });

            if (block.children?.length) {
                visit(block.children);
            }
        }
    };

    visit(blocks);
    return [...tagIds];
}

let editorInstance: ServerBlockNoteEditor | null = null;

function getEditor(): ServerBlockNoteEditor {
    if (!editorInstance) {
        editorInstance = ServerBlockNoteEditor.create();
    }
    return editorInstance;
}

export async function blocksToMarkdown(contentJson: string): Promise<string> {
    try {
        const blocks = parseBlockNoteContent(contentJson);
        const supportedBlocks = stripUnsupportedMarkdownBlocks(blocks);
        const placeholderToTag = new Map<string, string>();
        const processed = preprocessCustomInlineContent(supportedBlocks, placeholderToTag, { value: 0 });
        const editor = getEditor();
        const markdown = await editor.blocksToMarkdownLossy(
            processed as Parameters<typeof editor.blocksToMarkdownLossy>[0],
        );
        return restoreTagPlaceholdersInMarkdown(markdown, placeholderToTag);
    } catch {
        return '';
    }
}

export async function markdownToBlocksJson(
    markdown: string,
    deps: MarkdownImportDeps = defaultMarkdownImportDeps,
): Promise<string> {
    const editor = getEditor();
    const preprocessedMarkdown = preprocessMarkdownExplicitTags(markdown);
    const preprocessedReferenceMarkdown = preprocessMarkdownExplicitReferences(preprocessedMarkdown.markdown);
    const tildeProtectedMarkdown = protectMarkdownNumericTildeRanges(preprocessedReferenceMarkdown.markdown);
    const hardBreakProtectedMarkdown = protectMarkdownLineEndHardBreakMarkers(tildeProtectedMarkdown.markdown);
    const basePlaceholderToToken = new Map([
        ...tildeProtectedMarkdown.placeholderToToken,
        ...hardBreakProtectedMarkdown.placeholderToToken,
    ]);
    const contentJson = await parseMarkdownToContentJson(
        editor,
        hardBreakProtectedMarkdown.markdown,
        deps,
        preprocessedMarkdown.placeholderToTag,
        preprocessedReferenceMarkdown.placeholderToReference,
        basePlaceholderToToken,
    );

    if (extractLiteralAngleBracketTextTokens(preprocessedReferenceMarkdown.markdown).length === 0) {
        return contentJson;
    }

    if (
        !hasLiteralAngleBracketTextTokenLoss(
            preprocessedReferenceMarkdown.markdown,
            await blocksToMarkdown(contentJson),
        )
    ) {
        return contentJson;
    }

    const protectedMarkdown = protectMarkdownTextAngleBrackets(hardBreakProtectedMarkdown.markdown);
    const placeholderToToken = new Map([...basePlaceholderToToken, ...protectedMarkdown.placeholderToToken]);

    return parseMarkdownToContentJson(
        editor,
        protectedMarkdown.markdown,
        deps,
        preprocessedMarkdown.placeholderToTag,
        preprocessedReferenceMarkdown.placeholderToReference,
        placeholderToToken,
    );
}

async function parseMarkdownToContentJson(
    editor: ServerBlockNoteEditor,
    markdown: string,
    deps: MarkdownImportDeps,
    placeholderToTag: Map<string, string>,
    placeholderToReference: Map<string, { id: string; title: string; token: string }> = new Map(),
    placeholderToProtectedTextToken: Map<string, string> = new Map(),
) {
    const blocks = await editor.tryParseMarkdownToBlocks(markdown);
    const restoredBlocks = await restoreCustomInlineContent(
        blocks as BlockNote[],
        deps,
        placeholderToTag,
        placeholderToReference,
    );
    const restoredTagBlocks = restoreRemainingTagPlaceholders(restoredBlocks, placeholderToTag);
    const restoredProtectedTextBlocks = restoreProtectedTextPlaceholders(
        restoredTagBlocks,
        placeholderToProtectedTextToken,
    );

    return JSON.stringify(restoredProtectedTextBlocks);
}

export function extractTagIdsFromContentJson(contentJson: string): string[] {
    const blocks = parseBlockNoteContent(contentJson);
    return collectTagIds(blocks);
}

export function hasUnsupportedMarkdownBlocks(contentJson: string): boolean {
    try {
        let hasUnsupportedBlock = false;
        visitBlocks(parseBlockNoteContent(contentJson), (block) => {
            if (UNSUPPORTED_MARKDOWN_BLOCK_TYPES.has(block.type)) {
                hasUnsupportedBlock = true;
            }
        });

        return hasUnsupportedBlock;
    } catch {
        return false;
    }
}

export function countReferenceInlinesFromContentJson(contentJson: string): number {
    try {
        let count = 0;
        visitBlocks(parseBlockNoteContent(contentJson), (block) => {
            visitBlockContent(block.content, (inline) => {
                if (inline.type === 'reference') {
                    count += 1;
                }
            });
        });

        return count;
    } catch {
        return 0;
    }
}
