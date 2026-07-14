import JSZip from 'jszip';

export { downloadBlobFile, downloadTextFile } from './file-download';

export interface NoteExportMetadata {
    id: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
}

type FetchAsset = typeof fetch;

interface HtmlAssetsZipExportOptions {
    fetchImpl?: FetchAsset;
    includeMetadata?: boolean;
}

interface HtmlDocumentExportOptions {
    includeMetadata?: boolean;
}

interface MarkdownDocumentExportOptions {
    includeMetadata?: boolean;
}

const YAML_SPECIAL_CHAR_PATTERN = /[:{}[\],&*#?|<>=!%@`-]/;
const LOCAL_IMAGE_ASSET_PREFIX = '/assets/images/';

const normalizeTitleForFilename = (title: string) => {
    const normalized = title
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return normalized || 'untitled-note';
};

const formatYamlString = (value: string) => {
    if (!value) {
        return '""';
    }

    if (YAML_SPECIAL_CHAR_PATTERN.test(value) || /^\s|\s$/.test(value)) {
        return JSON.stringify(value);
    }

    return value;
};

const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) {
        return undefined;
    }

    const numericTimestamp = Number(timestamp);

    if (!Number.isFinite(numericTimestamp)) {
        return timestamp;
    }

    return new Date(numericTimestamp).toISOString();
};

const getDocumentOrigin = () => {
    if (typeof window === 'undefined' || !window.location?.origin) {
        return 'http://localhost';
    }

    return window.location.origin;
};

const isLocalImageAssetUrl = (src: string, origin = getDocumentOrigin()) => {
    try {
        const url = new URL(src, origin);

        return url.origin === origin && url.pathname.startsWith(LOCAL_IMAGE_ASSET_PREFIX);
    } catch {
        return false;
    }
};

const getImageAssetRequestPath = (src: string, origin = getDocumentOrigin()) => {
    const url = new URL(src, origin);

    return `${url.pathname}${url.search}`;
};

const getResponseContentType = (response: Response) => {
    return response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
};

const sanitizeZipAssetName = (value: string) => {
    const withoutUnsafeChars = value
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .split('')
        .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
        .join('');
    const sanitized = withoutUnsafeChars.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    return sanitized || 'image';
};

const splitFileName = (fileName: string) => {
    const dotIndex = fileName.lastIndexOf('.');

    if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
        return {
            baseName: fileName,
            extension: '',
        };
    }

    return {
        baseName: fileName.slice(0, dotIndex),
        extension: fileName.slice(dotIndex),
    };
};

const createZipAssetName = (src: string, index: number, usedNames: Set<string>) => {
    const url = new URL(src, getDocumentOrigin());
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const rawName = decodeURIComponent(pathSegments[pathSegments.length - 1] ?? '');
    const fallbackName = `image-${index + 1}`;
    const { baseName, extension } = splitFileName(sanitizeZipAssetName(rawName || fallbackName));
    let candidate = `${baseName}${extension}`;
    let suffix = 2;

    while (usedNames.has(candidate)) {
        candidate = `${baseName}-${suffix}${extension}`;
        suffix += 1;
    }

    usedNames.add(candidate);

    return `assets/${candidate}`;
};

const findTagEnd = (html: string, startIndex: number) => {
    let quote: '"' | "'" | null = null;

    for (let index = startIndex; index < html.length; index += 1) {
        const character = html[index];

        if (quote) {
            if (character === quote) {
                quote = null;
            }

            continue;
        }

        if (character === '"' || character === "'") {
            quote = character;
            continue;
        }

        if (character === '>') {
            return index;
        }
    }

    return -1;
};

const findNextImageTagStart = (html: string, startIndex: number) => {
    let searchIndex = startIndex;

    while (searchIndex < html.length) {
        const tagStart = html.toLowerCase().indexOf('<img', searchIndex);

        if (tagStart === -1) {
            return -1;
        }

        const nextCharacter = html[tagStart + 4];
        const previousTagStart = tagStart === 0 ? -1 : html.lastIndexOf('<', tagStart - 1);
        const previousTagEnd = tagStart === 0 ? -1 : html.lastIndexOf('>', tagStart - 1);

        if (previousTagStart <= previousTagEnd && (!nextCharacter || /[\s/>]/.test(nextCharacter))) {
            return tagStart;
        }

        searchIndex = tagStart + 4;
    }

    return -1;
};

const findAttributeValueRange = (html: string, startIndex: number, endIndex: number, attributeName: string) => {
    let index = startIndex;

    while (index < endIndex) {
        while (index < endIndex && /[\s/]/.test(html[index])) {
            index += 1;
        }

        const nameStart = index;

        while (index < endIndex && /[^\s=/>]/.test(html[index])) {
            index += 1;
        }

        const name = html.slice(nameStart, index).toLowerCase();

        while (index < endIndex && /\s/.test(html[index])) {
            index += 1;
        }

        if (html[index] !== '=') {
            continue;
        }

        index += 1;

        while (index < endIndex && /\s/.test(html[index])) {
            index += 1;
        }

        const quote = html[index];

        if (quote === '"' || quote === "'") {
            const valueStart = index + 1;
            const valueEnd = html.indexOf(quote, valueStart);

            if (valueEnd === -1 || valueEnd > endIndex) {
                return undefined;
            }

            index = valueEnd + 1;

            if (name === attributeName) {
                return {
                    end: valueEnd,
                    start: valueStart,
                    value: html.slice(valueStart, valueEnd),
                };
            }

            continue;
        }

        const valueStart = index;

        while (index < endIndex && /[^\s>]/.test(html[index])) {
            index += 1;
        }

        if (name === attributeName) {
            return {
                end: index,
                start: valueStart,
                value: html.slice(valueStart, index),
            };
        }
    }

    return undefined;
};

const findImageTags = (html: string) => {
    const ranges: Array<{
        end: number;
        source: { end: number; start: number; value: string };
        start: number;
    }> = [];
    let searchIndex = 0;

    while (searchIndex < html.length) {
        const tagStart = findNextImageTagStart(html, searchIndex);

        if (tagStart === -1) {
            break;
        }

        const tagEnd = findTagEnd(html, tagStart + 4);

        if (tagEnd === -1) {
            break;
        }

        const srcRange = findAttributeValueRange(html, tagStart + 4, tagEnd, 'src');

        if (srcRange) {
            ranges.push({
                end: tagEnd + 1,
                source: srcRange,
                start: tagStart,
            });
        }

        searchIndex = tagEnd + 1;
    }

    return ranges;
};

const applyHtmlReplacements = (
    html: string,
    replacements: Array<{
        end: number;
        start: number;
        value: string;
    }>,
) => {
    let rewrittenHtml = html;

    for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
        rewrittenHtml = `${rewrittenHtml.slice(0, replacement.start)}${replacement.value}${rewrittenHtml.slice(
            replacement.end,
        )}`;
    }

    return rewrittenHtml;
};

const applyTextReplacements = (
    text: string,
    replacements: Array<{
        end: number;
        start: number;
        value: string;
    }>,
) => {
    let rewrittenText = text;

    for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
        rewrittenText = `${rewrittenText.slice(0, replacement.start)}${replacement.value}${rewrittenText.slice(
            replacement.end,
        )}`;
    }

    return rewrittenText;
};

const findMarkdownImageTags = (markdown: string) => {
    const ranges: Array<{
        end: number;
        source: { end: number; start: number; value: string };
        start: number;
    }> = [];
    let searchIndex = 0;

    while (searchIndex < markdown.length) {
        const start = markdown.indexOf('![', searchIndex);

        if (start === -1) {
            break;
        }

        let cursor = start + 2;
        let altDepth = 1;

        while (cursor < markdown.length && altDepth > 0 && markdown[cursor] !== '\n') {
            if (markdown[cursor] === '\\') {
                cursor += 2;
                continue;
            }

            if (markdown[cursor] === '[') {
                altDepth += 1;
            } else if (markdown[cursor] === ']') {
                altDepth -= 1;
            }

            cursor += 1;
        }

        if (altDepth !== 0 || markdown[cursor] !== '(') {
            searchIndex = start + 2;
            continue;
        }

        const sourceStartWithWhitespace = cursor + 1;
        let sourceStart = sourceStartWithWhitespace;

        while (sourceStart < markdown.length && markdown[sourceStart] !== '\n' && /\s/.test(markdown[sourceStart])) {
            sourceStart += 1;
        }

        if (sourceStart >= markdown.length || markdown[sourceStart] === '\n') {
            searchIndex = start + 2;
            continue;
        }

        let sourceEnd = sourceStart;
        let sourceValueStart = sourceStart;
        let sourceValueEnd = sourceStart;

        if (markdown[sourceStart] === '<') {
            cursor = sourceStart + 1;

            while (cursor < markdown.length && markdown[cursor] !== '>' && markdown[cursor] !== '\n') {
                cursor += markdown[cursor] === '\\' ? 2 : 1;
            }

            if (markdown[cursor] !== '>') {
                searchIndex = start + 2;
                continue;
            }

            sourceEnd = cursor + 1;
            sourceValueStart = sourceStart + 1;
            sourceValueEnd = cursor;
        } else {
            let parenDepth = 0;
            cursor = sourceStart;

            while (cursor < markdown.length && markdown[cursor] !== '\n') {
                const character = markdown[cursor];

                if (character === '\\') {
                    cursor += 2;
                    continue;
                }

                if (/\s/.test(character) && parenDepth === 0) {
                    break;
                }

                if (character === '(') {
                    parenDepth += 1;
                } else if (character === ')') {
                    if (parenDepth === 0) {
                        break;
                    }

                    parenDepth -= 1;
                }

                cursor += 1;
            }

            sourceEnd = cursor;
            sourceValueStart = sourceStart;
            sourceValueEnd = sourceEnd;
        }

        if (sourceValueEnd <= sourceValueStart) {
            searchIndex = start + 2;
            continue;
        }

        cursor = sourceEnd;

        while (cursor < markdown.length && markdown[cursor] !== '\n' && /\s/.test(markdown[cursor])) {
            cursor += 1;
        }

        if (markdown[cursor] === '"' || markdown[cursor] === "'") {
            const quote = markdown[cursor];
            cursor += 1;

            while (cursor < markdown.length && markdown[cursor] !== '\n') {
                if (markdown[cursor] === '\\') {
                    cursor += 2;
                    continue;
                }

                if (markdown[cursor] === quote) {
                    cursor += 1;
                    break;
                }

                cursor += 1;
            }
        }

        while (cursor < markdown.length && markdown[cursor] !== '\n' && /\s/.test(markdown[cursor])) {
            cursor += 1;
        }

        if (markdown[cursor] !== ')') {
            searchIndex = start + 2;
            continue;
        }

        ranges.push({
            end: cursor + 1,
            source: {
                end: sourceEnd,
                start: sourceStartWithWhitespace,
                value: markdown.slice(sourceValueStart, sourceValueEnd),
            },
            start,
        });

        searchIndex = cursor + 1;
    }

    return ranges;
};

export const getNoteExportFilename = (title: string, extension: 'md' | 'html' | 'zip') => {
    return `${normalizeTitleForFilename(title)}.${extension}`;
};

export const createMarkdownFrontmatter = ({ id, title, createdAt, updatedAt }: NoteExportMetadata) => {
    const lines = ['---', `title: ${formatYamlString(title)}`, `note_id: ${formatYamlString(id)}`];
    const formattedCreatedAt = formatTimestamp(createdAt);
    const formattedUpdatedAt = formatTimestamp(updatedAt);

    if (formattedCreatedAt) {
        lines.push(`created_at: ${formatYamlString(formattedCreatedAt)}`);
    }

    if (formattedUpdatedAt) {
        lines.push(`updated_at: ${formatYamlString(formattedUpdatedAt)}`);
    }

    lines.push('source: ocean-brain', '---');

    return lines.join('\n');
};

export const createMarkdownExport = (markdown: string, metadata: NoteExportMetadata, includeMetadata = false) => {
    if (!includeMetadata) {
        return markdown;
    }

    return `${createMarkdownFrontmatter(metadata)}\n\n${markdown}`;
};

export const createMarkdownDocumentExport = (
    markdown: string,
    metadata: NoteExportMetadata,
    { includeMetadata = false }: MarkdownDocumentExportOptions = {},
) => {
    const markdownExport = createMarkdownExport(markdown, metadata, includeMetadata);
    const replacements = findMarkdownImageTags(markdownExport)
        .filter((imageTag) => isLocalImageAssetUrl(imageTag.source.value))
        .map((imageTag) => ({
            end: imageTag.end,
            start: imageTag.start,
            value: '',
        }));

    return applyTextReplacements(markdownExport, replacements);
};

export const createHtmlExport = (
    html: string,
    metadata: NoteExportMetadata,
    { includeMetadata = false }: HtmlDocumentExportOptions = {},
) => {
    const metadataComment = includeMetadata
        ? `<!--\nsource: ocean-brain\nnote_id: ${metadata.id}\ntitle: ${metadata.title}\ncreated_at: ${formatTimestamp(metadata.createdAt) ?? ''}\nupdated_at: ${formatTimestamp(metadata.updatedAt) ?? ''}\n-->\n`
        : '';

    return `${metadataComment}${html}`;
};

export const createHtmlDocumentExport = (
    html: string,
    metadata: NoteExportMetadata,
    { includeMetadata = false }: HtmlDocumentExportOptions = {},
) => {
    const htmlExport = createHtmlExport(html, metadata, { includeMetadata });
    const replacements = findImageTags(htmlExport)
        .filter((imageTag) => isLocalImageAssetUrl(imageTag.source.value))
        .map((imageTag) => ({
            end: imageTag.end,
            start: imageTag.start,
            value: '',
        }));

    return applyHtmlReplacements(htmlExport, replacements);
};

export const createHtmlAssetsZipExport = async (
    html: string,
    metadata: NoteExportMetadata,
    { fetchImpl = fetch, includeMetadata = false }: HtmlAssetsZipExportOptions = {},
) => {
    const zip = new JSZip();
    const htmlExport = createHtmlExport(html, metadata, { includeMetadata });
    const imageTags = findImageTags(htmlExport);
    const replacements: Array<{ end: number; start: number; value: string }> = [];
    const usedNames = new Set<string>();
    const assetNameByRequestPath = new Map<string, string>();

    for (const { source: imageSourceRange } of imageTags) {
        if (!isLocalImageAssetUrl(imageSourceRange.value)) {
            continue;
        }

        const requestPath = getImageAssetRequestPath(imageSourceRange.value);
        let zipAssetName = assetNameByRequestPath.get(requestPath);

        if (!zipAssetName) {
            zipAssetName = createZipAssetName(requestPath, assetNameByRequestPath.size, usedNames);
            assetNameByRequestPath.set(requestPath, zipAssetName);

            const response = await fetchImpl(requestPath, { credentials: 'same-origin' });

            if (!response.ok) {
                throw new Error(`Failed to fetch image asset: ${requestPath}`);
            }

            if (!getResponseContentType(response).startsWith('image/')) {
                throw new Error(`Image asset did not return image content: ${requestPath}`);
            }

            zip.file(zipAssetName, new Uint8Array(await response.arrayBuffer()));
        }

        replacements.push({
            end: imageSourceRange.end,
            start: imageSourceRange.start,
            value: `./${zipAssetName}`,
        });
    }

    zip.file('note.html', applyHtmlReplacements(htmlExport, replacements));

    return zip.generateAsync({ type: 'blob' });
};

export const createMarkdownAssetsZipExport = async (
    markdown: string,
    metadata: NoteExportMetadata,
    { fetchImpl = fetch, includeMetadata = false }: HtmlAssetsZipExportOptions = {},
) => {
    const zip = new JSZip();
    const markdownExport = createMarkdownExport(markdown, metadata, includeMetadata);
    const imageTags = findMarkdownImageTags(markdownExport);
    const replacements: Array<{ end: number; start: number; value: string }> = [];
    const usedNames = new Set<string>();
    const assetNameByRequestPath = new Map<string, string>();

    for (const { source: imageSourceRange } of imageTags) {
        if (!isLocalImageAssetUrl(imageSourceRange.value)) {
            continue;
        }

        const requestPath = getImageAssetRequestPath(imageSourceRange.value);
        let zipAssetName = assetNameByRequestPath.get(requestPath);

        if (!zipAssetName) {
            zipAssetName = createZipAssetName(requestPath, assetNameByRequestPath.size, usedNames);
            assetNameByRequestPath.set(requestPath, zipAssetName);

            const response = await fetchImpl(requestPath, { credentials: 'same-origin' });

            if (!response.ok) {
                throw new Error(`Failed to fetch image asset: ${requestPath}`);
            }

            if (!getResponseContentType(response).startsWith('image/')) {
                throw new Error(`Image asset did not return image content: ${requestPath}`);
            }

            zip.file(zipAssetName, new Uint8Array(await response.arrayBuffer()));
        }

        replacements.push({
            end: imageSourceRange.end,
            start: imageSourceRange.start,
            value: `./${zipAssetName}`,
        });
    }

    zip.file('note.md', applyTextReplacements(markdownExport, replacements));

    return zip.generateAsync({ type: 'blob' });
};
