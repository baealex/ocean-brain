import { IMPORT_MARKDOWN_CHARS, IMPORT_REQUEST_BYTES, importJsonBytes } from './limits';
import {
    asList,
    EXPORT_PROPERTIES,
    parseFrontmatter,
    parseImportDate,
    recommendPropertyType,
    TOOL_PROPERTIES,
} from './metadata';
import { isNotionPage, prepareNotion } from './notion';
import {
    basename,
    cleanNotionName,
    createPathResolver,
    decodePath,
    dirname,
    imageContentType,
    normalizePath,
    withoutMarkdown,
} from './paths';
import {
    type ImportFile,
    type ImportIssue,
    type ImportNote,
    type ImportOptions,
    type ImportPlan,
    recordSyntax,
    type SyntaxCount,
} from './types';

export { normalizePropertyValue, parseImportDate } from './metadata';
export { imageContentType, normalizePath } from './paths';
export * from './types';

const IGNORED_PARTS = new Set(['.obsidian', '.git', '.trash', '.github', 'node_modules', '__MACOSX']);
const COMMENT_REPEAT_NOTES = 3;
const commentKey = (text: string) => text.replace(/\s+/g, ' ').trim();
const COMMENT = /%%([\s\S]*?)%%|<!--([\s\S]*?)-->/g;
const escapeLabel = (text: string) => text.replace(/[|[\]\\]/g, '\\$&').replace(/\n/g, ' ');
const noteUrl = (path: string) => `ocean-import-note:${encodeURIComponent(path)}`;
const assetUrl = (path: string) => `ocean-import-asset:${encodeURIComponent(path)}`;
/** Repeat a removal until the text stops changing, so removed pieces cannot join into new markup. */
const replaceUntilStable = (
    text: string,
    pattern: RegExp,
    replacer: (match: string, ...groups: (string | undefined)[]) => string,
) => {
    let previous: string;
    do {
        previous = text;
        text = text.replace(pattern, replacer);
    } while (text !== previous);
    return text;
};

/** Keep code completely opaque to import syntax rules, including comments and tags. */
export function protectCode(text: string) {
    const values: string[] = [];
    let prefix = '\uE000CODE';
    while (text.includes(prefix)) prefix += 'X';
    const store = (value: string) => {
        const key = `${prefix}${values.length}\uE001`;
        values.push(value);
        return key;
    };
    const maskInline = (source: string) => {
        let result = '';
        for (let cursor = 0; cursor < source.length; ) {
            if (source[cursor] !== '`') {
                result += source[cursor++];
                continue;
            }
            const start = cursor;
            while (source[cursor] === '`') cursor++;
            let slash = start;
            while (source[slash - 1] === '\\') slash--;
            if ((start - slash) % 2) {
                result += source.slice(start, cursor);
                continue;
            }
            const size = cursor - start;
            let search = cursor;
            let closed = false;
            while (search < source.length) {
                const tick = source.indexOf('`', search);
                if (tick < 0) break;
                const between = source.slice(cursor, tick);
                if (between.includes(prefix) || /\n[ \t]*\n/.test(between)) break;
                let end = tick;
                while (source[end] === '`') end++;
                if (end - tick === size) {
                    result += store(source.slice(start, end));
                    cursor = end;
                    closed = true;
                    break;
                }
                search = end;
            }
            if (!closed) result += source.slice(start, cursor);
        }
        return result;
    };
    const stripQuotes = (line: string, depth: number) => {
        for (let level = 0; level < depth; level++) line = line.replace(/^[ \t]*>[ \t]?/, '');
        return line;
    };
    let fence: { marker: string; lines: string[]; indent: string; quoteDepth: number } | undefined;
    let listContentIndent: number | undefined;
    let htmlBlock = false;
    const lines: string[] = [];
    for (const line of text.split('\n')) {
        const quoteDepth = line.match(/^(?:[ \t]*>[ \t]?)+/)?.[0].match(/>/g)?.length ?? 0;
        const candidate = stripQuotes(line, fence?.quoteDepth ?? quoteDepth);
        const match = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(candidate);
        const list = /^(\s*)(?:[-*+]|\d+[.)])\s+/.exec(line);
        if (list) listContentIndent = list[0].length;
        else if (line.trim() && !/^\s|^>/.test(line)) listContentIndent = undefined;
        if (fence) {
            fence.lines.push(candidate.startsWith(fence.indent) ? candidate.slice(fence.indent.length) : candidate);
            if (
                match &&
                match[2][0] === fence.marker[0] &&
                match[2].length >= fence.marker.length &&
                !match[3].trim()
            ) {
                lines.push(store(fence.lines.join('\n')));
                fence = undefined;
            }
        } else if (match)
            fence = { marker: match[2], lines: [candidate.slice(match[1].length)], indent: match[1], quoteDepth };
        else if (
            !htmlBlock &&
            /^(?: {4}|\t)/.test(line) &&
            (listContentIndent === undefined || (line.match(/^ */)?.[0].length ?? 0) >= listContentIndent + 4)
        )
            lines.push(store(line));
        else {
            const proseLine = maskInline(line);
            lines.push(proseLine);
            if (/<(?:table|div|p|aside)\b[^>]*>/i.test(proseLine)) htmlBlock = true;
            if (/<\/(?:table|div|p|aside)>/i.test(proseLine)) htmlBlock = false;
        }
    }
    if (fence) lines.push(store(fence.lines.join('\n')));
    return {
        text: maskInline(lines.join('\n')),
        count: values.length,
        restore: (value: string) =>
            value.replace(new RegExp(`${prefix}(\\d+)\uE001`, 'g'), (_, index: string) => values[Number(index)]),
    };
}

// Balanced destinations cover escaped spaces, parentheses, titles and angle destinations.
export function transformMarkdownLinks(
    text: string,
    transform: (input: { raw: string; label: string; target: string; image: boolean; title?: string }) => string,
) {
    let output = '';
    for (let index = 0; index < text.length; ) {
        const start = index;
        const image = text[index] === '!' && text[index + 1] === '[';
        const bracket = image ? index + 1 : index;
        if (text[bracket] !== '[' || (start > 0 && text[start - 1] === '\\')) {
            output += text[index++];
            continue;
        }
        let end = bracket + 1;
        let depth = 1;
        for (; end < text.length && depth; end++) {
            if (text[end] === '\\') {
                end++;
                continue;
            }
            if (text[end] === '[') depth++;
            if (text[end] === ']') depth--;
        }
        if (depth || text[end] !== '(') {
            output += text[index++];
            continue;
        }
        const label = text.slice(bracket + 1, end - 1);
        let close = end + 1;
        depth = 1;
        let quote = '';
        for (; close < text.length && depth; close++) {
            const char = text[close];
            if (char === '\\') {
                close++;
                continue;
            }
            if (quote) {
                if (char === quote) quote = '';
                continue;
            }
            if ((char === '"' || char === "'") && /\s/.test(text[close - 1])) {
                quote = char;
                continue;
            }
            if (char === '(') depth++;
            if (char === ')') depth--;
        }
        if (depth) {
            output += text[index++];
            continue;
        }
        const destination = text.slice(end + 1, close - 1).trim();
        const titleMatch = /\s+(["'])([\s\S]*)\1$/.exec(destination);
        const target = (titleMatch ? destination.slice(0, titleMatch.index) : destination).replace(/^<|>$/g, '');
        const raw = text.slice(start, close);
        output +=
            /^\[[^\]\n]+\]$/.test(label) && !/^note:\d+$/.test(target)
                ? raw
                : transform({ raw, label, target, image, title: titleMatch?.[2] });
        index = close;
    }
    return output;
}

function prepareNotes(files: ImportFile[], issues: ImportIssue[], syntax: Record<string, SyntaxCount>): ImportNote[] {
    return files
        .filter((file) => /\.md$/i.test(file.path) && file.text !== undefined)
        .map((file) => {
            const { body, properties, unparsed } = parseFrontmatter((file.text ?? '').replace(/\r\n?/g, '\n'));
            let markdown = body;
            if (unparsed.length) {
                markdown = `> **Metadata**\n${unparsed.map((line) => `> ${line}`).join('\n')}\n\n${markdown}`;
                issues.push({
                    kind: 'metadata-fallback',
                    path: file.path,
                    value: unparsed.join('\n'),
                    reason: 'unrecognized YAML retained visibly',
                });
            }
            const filename = cleanNotionName(withoutMarkdown(basename(file.path)));
            const h1 = /^\s*# ([^\n]+)\n?/.exec(markdown);
            let filenameTitle = filename;
            if (/^(?:readme|index|untitled)$/i.test(filename)) {
                const prose = protectCode(markdown);
                const firstHeading = /^# ([^\n]+)$/m.exec(prose.text);
                if (firstHeading) filenameTitle = prose.restore(firstHeading[1]).trim();
            }
            const title = asList(properties.title)[0] || filenameTitle;
            if (h1 && h1[1].trim().normalize('NFC') === title.normalize('NFC')) {
                markdown = markdown.slice(h1[0].length).replace(/^\n/, '');
                issues.push({ kind: 'duplicate-heading', path: file.path, value: h1[1], reason: 'same as note title' });
                recordSyntax(syntax, 'duplicate-heading', 'dropped');
            }
            const date = (keys: string[]) => {
                for (const key of keys) {
                    const raw = asList(properties[key])[0];
                    if (!raw) continue;
                    const parsed = parseImportDate(raw);
                    if (parsed) return parsed;
                    issues.push({
                        kind: 'invalid-date',
                        path: file.path,
                        value: `${key}: ${raw}`,
                        reason: 'retained as a property; not a valid original timestamp',
                    });
                }
                return undefined;
            };
            const createdAt = date(['created', 'created_at', 'date']);
            const updatedAt = date(['updated', 'updated_at']);
            const userProperties = Object.fromEntries(
                Object.entries(properties).filter(([key, value]) => {
                    if (['title', 'tags', 'aliases'].includes(key)) {
                        recordSyntax(syntax, `frontmatter:${key}`, 'changed');
                        return false;
                    }
                    if (EXPORT_PROPERTIES.has(key) && (key !== 'source' || asList(value)[0] === 'ocean-brain')) {
                        issues.push({
                            kind: 'export-metadata',
                            path: file.path,
                            value: `${key}: ${asList(value).join(', ')}`,
                            reason: 'tool generated identity metadata',
                        });
                        recordSyntax(syntax, 'export-metadata', 'dropped');
                        return false;
                    }
                    if (
                        ['created', 'created_at', 'date', 'updated', 'updated_at'].includes(key) &&
                        parseImportDate(asList(value)[0])
                    ) {
                        recordSyntax(syntax, 'dates', 'changed');
                        return false;
                    }
                    if (!asList(value).length) {
                        issues.push({ kind: 'empty-property', path: file.path, value: key, reason: 'empty value' });
                        recordSyntax(syntax, 'empty-property', 'dropped');
                        return false;
                    }
                    return true;
                }),
            );
            return {
                path: file.path,
                title,
                markdown,
                aliases: asList(properties.aliases),
                tags: asList(properties.tags)
                    .flatMap((tag) => tag.split(/[,\s]+/))
                    .map((tag) => tag.replace(/^[#@]/, '')),
                properties: userProperties,
                createdAt,
                updatedAt,
                originalId: asList(properties.note_id)[0],
            };
        });
}

function relocateTableImages(text: string, moved: () => void) {
    return text.replace(/(?:^[ \t]*\|[^\n]*(?:\n|$))+/gm, (table) => {
        const images: string[] = [];
        const retain = (raw: string, label: string, target: string) => {
            images.push(raw);
            moved();
            return (label || basename(decodePath(target.split('#')[0]))).replace(/\\?\|/g, '\\|');
        };
        const wiki = table.replace(/!\[\[([^\]\n]+)\]\]/g, (raw, inner: string) => {
            const [target, alias] = inner.replace(/\\\|/g, '|').split('|');
            return retain(raw, alias && !/^\d+(?:x\d+)?$/i.test(alias) ? alias : '', target);
        });
        const output = transformMarkdownLinks(wiki, ({ raw, label, target, image }) =>
            image ? retain(raw, label, target) : raw,
        );
        return images.length ? `${output.trimEnd()}\n\n${images.join('\n\n')}\n\n` : table;
    });
}

interface TransformDiagnostics {
    report: (kind: string, value: string, reason: string) => void;
    count: (kind: string, action?: keyof SyntaxCount, amount?: number) => void;
}
interface ImportLinkContext extends TransformDiagnostics {
    note: ImportNote;
    resolve: ReturnType<typeof createPathResolver>;
    notion: Pick<ReturnType<typeof prepareNotion>, 'csvTargets'>;
    byOriginalId: Map<string, ImportNote[]>;
    byPath: Map<string, ImportNote>;
    assetPaths: Set<string>;
    usedFiles: Set<string>;
    links: ImportPlan['links'];
    images: ImportPlan['images'];
}

function collectImportProperties(
    note: ImportNote,
    options: ImportOptions,
    propertyValues: Map<string, { values: string[]; list: boolean }>,
    { report, count }: TransformDiagnostics,
) {
    for (const [key, value] of Object.entries(note.properties)) {
        const entry = propertyValues.get(key) ?? { values: [], list: false };
        entry.values.push(...asList(value));
        entry.list ||= Array.isArray(value);
        propertyValues.set(key, entry);
        if (options.listPropertiesAsTags?.includes(key)) {
            for (const raw of asList(value)) {
                const tag = raw.replace(/^[#@]/, '');
                if (/^[^\s[\]]+$/.test(tag)) note.tags.push(tag);
                else {
                    const marker = '`'.repeat(
                        Math.max(1, ...[...raw.matchAll(/`+/g)].map((match) => match[0].length + 1)),
                    );
                    note.markdown += `\n\n**${key}:** ${marker}${raw}${marker}`;
                    report('unsupported-tag', raw, 'tag names must be one token; original value retained visibly');
                }
            }
            delete note.properties[key];
            count('property-to-tags');
        } else if (
            options.discardedProperties?.includes(key) ||
            (TOOL_PROPERTIES.has(key) && !options.enabledToolProperties?.includes(key))
        ) {
            report(
                'discarded-property',
                `${key}: ${asList(value).join(', ')}`,
                TOOL_PROPERTIES.has(key) ? 'publishing setting disabled in preview' : 'discarded in preview',
            );
            delete note.properties[key];
            count('property', 'dropped');
        } else count('property');
    }
}

function removeGeneratedFooters(text: string, { report, count }: TransformDiagnostics) {
    text = text.replace(
        /(?:^#{1,6}[ \t]+This note in GitHub[ \t]*\n+)?<span\b[^>]*class=["'][^"']*\bgit-footer\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gim,
        (raw) => {
            if (!raw.includes('Edit In GitHub') || !raw.includes('Copy this note')) return raw;
            report('generated-footer', raw, 'generated edit/copy/download footer');
            count('generated-footer', 'dropped');
            return '';
        },
    );
    return text;
}

function countRetainedSyntax(text: string, code: ReturnType<typeof protectCode>, { count }: TransformDiagnostics) {
    for (const [kind, pattern] of Object.entries({
        heading: /^#{1,6}\s/gm,
        'table-row': /^\s*\|.*\|\s*$/gm,
        task: /^\s*[-*+]\s+\[[ xX]\]/gm,
        highlight: /==[^=\n]+==/g,
        math: /\$\$[\s\S]*?\$\$/g,
    })) {
        const matches = text.match(pattern)?.length ?? 0;
        if (matches) count(kind, 'kept', matches);
    }
    if (code.count) count('code', 'kept', code.count);
}

function transformNotionAsides(text: string, note: ImportNote, { report, count }: TransformDiagnostics) {
    if (isNotionPage(note.path)) {
        text = text.replace(/<aside\b[^>]*>([\s\S]*?)<\/aside>/gi, (_, content: string) => {
            const withoutIcons = content.replace(
                /<img\b[^>]*src=["']https:\/\/(?:app\.)?notion\.(?:so|com)\/icons\/[^"']+["'][^>]*>/gi,
                (raw) => {
                    report('notion-icon', raw, 'tool-generated callout icon');
                    count('notion-icon', 'dropped');
                    return '';
                },
            );
            count('notion-aside');
            return `\n\n> **Note**  \n${withoutIcons
                .trim()
                .split('\n')
                .map((line) => `> ${line}`)
                .join('\n')}\n\n`;
        });
        const mentions = text.match(/‣/g)?.length ?? 0;
        if (mentions) {
            report(
                'notion-missing-mention',
                String(mentions),
                'original mention target was already absent from the export',
            );
            count('notion-missing-mention', 'kept', mentions);
        }
    }
    return text;
}

function transformComments(
    text: string,
    comments: Map<string, number>,
    code: ReturnType<typeof protectCode>,
    { report, count }: TransformDiagnostics,
) {
    text = replaceUntilStable(text, COMMENT, (_, obsidianComment, htmlComment) => {
        const comment = obsidianComment ?? htmlComment ?? '';
        if ((comments.get(commentKey(code.restore(comment))) ?? 0) >= COMMENT_REPEAT_NOTES) {
            report('repeated-comment', code.restore(comment), `same comment in at least ${COMMENT_REPEAT_NOTES} notes`);
            count('comment', 'dropped');
            return '';
        }
        count('comment');
        return `\n\n> **Memo**\n${comment
            .trim()
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n')}\n\n`;
    });
    return text;
}

function transformCallouts(text: string, { report, count }: TransformDiagnostics) {
    text = text.replace(
        /^([ \t]*>\s*)\[!([\w-]+)\]([+-]?)[ \t]*(.*)$/gm,
        (_, prefix: string, type: string, fold: string, title: string) => {
            count('callout');
            if (fold) {
                report('callout-fold', fold, 'folding control removed');
                count('callout-fold', 'dropped');
            }
            count('callout-title-break');
            const label = type.toLowerCase().replace(/(^|-)\w/g, (part) => part.toUpperCase());
            return `${prefix}**${label}${title ? ':' : ''}**${title ? ` ${title}` : ''}  `;
        },
    );
    return text;
}

function transformFootnotesAndBlockIds(text: string, { report, count }: TransformDiagnostics) {
    text = text.replace(/(?:[ \t]+|(?<=[\]>])|^)\^([\w-]+)[ \t]*$/gm, (_, id: string) => {
        report('block-id', id, 'block anchor removed');
        count('block-id', 'dropped');
        return '';
    });
    text = text.replace(/^\[\^([^\]]+)\]:\s*/gm, (_, id: string) => {
        count('footnote');
        return `\n**Footnote ${id}:** `;
    });
    text = text.replace(/\[\^([^\]]+)\]/g, (_, id: string) => {
        count('footnote');
        return `(${id})`;
    });
    return text;
}

function transformHtml(text: string, { report, count }: TransformDiagnostics) {
    // Preserve URLs before generic HTML removal; markup itself is tool syntax.
    text = text.replace(/<(https?:\/\/[^>\s]+)>/g, '$1');
    text = text.replace(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi, (_, url: string) => {
        count('iframe');
        return `[${escapeLabel(url)}](${url})`;
    });
    text = text.replace(/^(\|[^\n]*)$/gm, (line) =>
        line.replace(/<br\s*\/?\s*>/gi, () => {
            count('html-table-break');
            return ' / ';
        }),
    );
    text = text.replace(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url: string, label: string) => {
        count('html-link');
        return `[${replaceUntilStable(label, /<[^>]*>/g, () => '')}](${url})`;
    });
    text = text.replace(/<img\b[^>]*>/gi, (tag) => {
        const src = /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
        const alt = /\balt=["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
        if (!src) {
            report('unsupported-html-image', tag, 'missing src');
            return alt;
        }
        count('html-image');
        return `![${escapeLabel(alt)}](${src})`;
    });
    text = replaceUntilStable(
        text,
        /<\/?(?:address|article|aside|b|blockquote|br|button|caption|center|code|dd|del|details|div|dl|dt|em|figcaption|figure|font|h[1-6]|hr|i|kbd|li|mark|ol|p|pre|rect|s|section|small|span|strong|sub|summary|sup|svg|table|tbody|td|th|thead|tr|u|ul)\b[^>]*>/gi,
        (tag) => {
            count('html');
            return /<\/?(?:div|p|br|h[1-6]|li|tr|aside|details|summary)\b/i.test(tag) ? '\n' : '';
        },
    );
    return text;
}

function transformImportLinks(text: string, context: ImportLinkContext) {
    const { note, report, count, resolve, notion, byOriginalId, byPath, assetPaths, usedFiles, links, images } =
        context;
    text = relocateTableImages(text, () => count('table-image'));
    const link = (target: string, label: string, raw: string, image: boolean, relative: boolean, width?: number) => {
        const hash = target.indexOf('#');
        const dest = hash < 0 ? target : target.slice(0, hash);
        if (!dest) {
            count('same-note-anchor');
            return label || decodePath(target.slice(1));
        }
        if (/^note:\d+$/.test(dest)) {
            const candidates = byOriginalId.get(dest.slice(5)) ?? [];
            const found = candidates.length === 1 ? candidates[0] : undefined;
            if (found) {
                const title = label.replace(/^\[|\]$/g, '');
                links.push({ from: note.path, to: found.path, label: title });
                count('export-reference');
                return `[${escapeLabel(title)}](${noteUrl(found.path)})`;
            }
            report(
                'unresolved-link',
                target,
                candidates.length
                    ? 'multiple files share the original Ocean Brain note ID'
                    : 'original Ocean Brain note not included in this import',
            );
            return raw;
        }
        if (/^[a-z][a-z\d+.-]*:/i.test(dest)) {
            count(image ? 'external-image' : 'external-link', 'kept');
            return image ? `\n\n${raw}\n\n` : raw;
        }
        const result = resolve(dest, note.path, relative);
        if (!result.path) {
            report(
                image ? 'unresolved-image' : 'unresolved-link',
                target,
                `${result.reason}${result.candidates ? `: ${result.candidates.join(', ')}` : ''}`,
            );
            count(image ? 'image' : 'link', 'kept');
            return raw;
        }
        const path = notion.csvTargets.get(result.path) ?? result.path;
        usedFiles.add(path);
        if (path === note.path && notion.csvTargets.has(result.path)) {
            report('notion-self-link', raw, 'CSV merged into this database note; link removed and label retained.');
            count('notion-self-link', 'dropped');
            return label;
        }
        if (hash >= 0) {
            report(
                'link-anchor',
                target.slice(hash + 1),
                byPath.has(path) ? 'heading or block anchor removed' : 'attachment display anchor removed',
            );
            count('link-anchor', 'dropped');
        }
        if (byPath.has(path)) {
            links.push({ from: note.path, to: path, label });
            count(image ? 'note-embed' : 'note-link');
            return `[${escapeLabel(label || byPath.get(path)!.title)}](${noteUrl(path)})`;
        }
        if (assetPaths.has(path)) {
            count(image ? 'image' : 'image-link');
            if (image) images.push({ from: note.path, to: path });
            const hint = width ? ` "ocean-import-width:${width}"` : '';
            const markdown = `${image ? '!' : ''}[${escapeLabel(label || basename(path))}](${assetUrl(path)}${hint})`;
            return image ? `\n\n${markdown}\n\n` : markdown;
        }
        report('unsupported-attachment', target, 'existing upload API does not accept this format');
        count('attachment', 'changed');
        const attachmentLabel = label && label !== basename(path) ? `${label} (${basename(path)})` : basename(path);
        return ` ${attachmentLabel} `;
    };
    text = text.replace(/(!?)\[\[([^\]\n]+)\]\](?!\(note:\d+\))/g, (raw, embed: string, inner: string) => {
        const unescaped = inner.replace(/\\\|/g, '|');
        const pipe = unescaped.indexOf('|');
        const target = pipe < 0 ? unescaped : unescaped.slice(0, pipe);
        const alias = pipe < 0 ? undefined : unescaped.slice(pipe + 1);
        const size = embed && alias && /^\d+(?:x\d+)?$/i.test(alias) ? Number(alias.split(/x/i)[0]) : undefined;
        if (size !== undefined) {
            count('image-size-hint');
            report('image-size-hint', alias!, 'Width preserved when supported; height follows the image aspect ratio.');
        }
        count('wikilink');
        return link(
            target.trim(),
            size !== undefined
                ? basename(target.split('#')[0])
                : (alias ?? (withoutMarkdown(basename(target.split('#')[0])) || target.slice(1))),
            raw,
            Boolean(embed),
            false,
            size,
        );
    });
    text = transformMarkdownLinks(text, ({ raw, label, target, image, title }) => {
        if (image) return raw;
        const children: Array<{ raw: string; label: string; target: string }> = [];
        transformMarkdownLinks(label, (child) => {
            if (child.image && child.raw === label) children.push(child);
            return child.raw;
        });
        const child = children[0];
        if (!child) return raw;
        count('linked-image');
        if (title !== undefined) {
            report('link-title', title, 'tooltip removed');
            count('link-title', 'dropped');
        }
        if (child.target === target) return child.raw;
        return `${child.raw}\n\n[${escapeLabel(child.label || 'Image')}](${target})`;
    });
    text = transformMarkdownLinks(text, ({ raw, label, target, image, title }) => {
        if (target.startsWith('ocean-import-')) return raw;
        if (title !== undefined) {
            report('link-title', title, 'tooltip removed');
            count('link-title', 'dropped');
        }
        const destination = /^[a-z][a-z\d+.-]*:/i.test(target)
            ? target.replace(/[ \t]/g, (space) => encodeURIComponent(space))
            : target;
        const withoutTitle = `${image ? '!' : ''}[${label}](${destination})`;
        return link(target, label, withoutTitle, image, true);
    });
    // Resolve reference-style Markdown using the same path rules.
    const definitions = new Map<string, string>();
    text = text.replace(
        /^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:[ \t]+["'][^\n]*["'])?[ \t]*$/gm,
        (raw, name: string, target: string) => {
            definitions.set(name.toLowerCase(), target.replace(/^<|>$/g, ''));
            return raw;
        },
    );
    const usedDefinitions = new Set<string>();
    text = text.replace(/(!?)\[([^\]\n]+)\]\[([^\]\n]*)\]/g, (raw, image: string, label: string, name: string) => {
        const key = (name || label).toLowerCase();
        const target = definitions.get(key);
        if (!target) return raw;
        usedDefinitions.add(key);
        return link(target, label, raw, Boolean(image), true);
    });
    text = text.replace(/^ {0,3}\[([^\]]+)\]:[^\n]*$/gm, (raw, key: string) =>
        usedDefinitions.has(key.toLowerCase()) ? '' : raw,
    );
    return text;
}

function preserveLiteralHtml(text: string, { report, count }: TransformDiagnostics) {
    const protectedLinks: string[] = [];
    text = transformMarkdownLinks(text, ({ raw }) => {
        const key = `\uE000LINK${protectedLinks.length}\uE001`;
        protectedLinks.push(raw);
        return key;
    });
    text = text.replace(/</g, () => {
        report('literal-html-marker', '<', 'escaped unsupported or incomplete HTML to preserve visible text');
        count('literal-html-marker');
        return '&lt;';
    });
    text = text.replace(/\uE000LINK(\d+)\uE001/g, (_, index: string) => protectedLinks[Number(index)]);
    return text;
}

function transformTags(
    text: string,
    note: ImportNote,
    disabledTags: Set<string>,
    allTags: Set<string>,
    { report, count }: TransformDiagnostics,
) {
    text = text.replace(/(^|[\s(,])#([\p{L}\p{N}_/-]+)/gu, (raw, prefix: string, tag: string) => {
        if (/^\d+$/.test(tag) || /^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(tag)) return raw;
        note.tags.push(tag);
        count('inline-tag');
        return `${prefix}${disabledTags.has(tag) ? `#${tag}` : `[@${tag}]`}`;
    });
    note.tags = [...new Set(note.tags.filter(Boolean))];
    for (const tag of note.tags) allTags.add(tag);
    const bodyTags = new Set([...text.matchAll(/\[@([^\]\s]+)\]/g)].map((match) => match[1]));
    for (const tag of bodyTags) {
        allTags.add(tag);
        if (!note.tags.includes(tag)) note.tags.push(tag);
    }
    text = text.replace(/\[@([^\]\s]+)\]/g, (raw, tag: string) => (disabledTags.has(tag) ? `#${tag}` : raw));
    const extraTags = note.tags.filter((tag) => !disabledTags.has(tag) && !bodyTags.has(tag));
    for (const tag of note.tags.filter((tag) => disabledTags.has(tag)))
        report('disabled-tag', tag, 'tag creation disabled in preview; original body text retained');
    if (extraTags.length) text += `\n\n${extraTags.map((tag) => `[@${tag}]`).join(' ')}`;
    return text;
}

function transformLineBreaks(text: string, options: ImportOptions, obsidian: boolean, { count }: TransformDiagnostics) {
    if ((options.lineBreaks ?? (obsidian ? 'preserve' : 'paragraph')) === 'preserve') {
        text = text
            .split('\n')
            .map((line, index, lines) => {
                const next = lines[index + 1] ?? '';
                const quote = (value: string) => {
                    const prefix = /^(?:[ \t]*>[ \t]?)+/.exec(value)?.[0] ?? '';
                    return { depth: prefix.match(/>/g)?.length ?? 0, body: value.slice(prefix.length) };
                };
                const currentQuote = quote(line);
                const nextQuote = quote(next);
                if (
                    currentQuote.depth !== nextQuote.depth ||
                    !currentQuote.body.trim() ||
                    !nextQuote.body.trim() ||
                    /^(?:\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\||\uE000))/.test(currentQuote.body) ||
                    /^(?:\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\||\uE000))/.test(nextQuote.body)
                )
                    return line;
                if (/ {2}$|\\$/.test(line)) return line;
                count('single-newline');
                return `${line}  `;
            })
            .join('\n');
    }
    return text;
}

export function analyzeImport(input: ImportFile[], options: ImportOptions = {}): ImportPlan {
    const issues: ImportIssue[] = [];
    const syntax: Record<string, SyntaxCount> = Object.create(null);
    const paths = new Set<string>();
    const files: ImportFile[] = [];
    for (const file of input) {
        const path = normalizePath(file.path);
        const reason = path.startsWith('../')
            ? 'path escapes selected folder'
            : path.split('/').some((part) => IGNORED_PARTS.has(part) || part.startsWith('.'))
              ? 'tool settings or hidden file'
              : paths.has(path)
                ? 'duplicate NFC normalized path'
                : undefined;
        if (reason) {
            issues.push({ kind: 'skipped-file', path: file.path, value: file.path, reason });
            continue;
        }
        paths.add(path);
        files.push({ ...file, path });
    }
    const notes = prepareNotes(files, issues, syntax);
    const notion = prepareNotion(files, notes, issues, syntax);
    const obsidian =
        input.some((file) => file.path.split('/').includes('.obsidian')) ||
        notes.some((note) => /!?\[\[/.test(protectCode(note.markdown).text));
    const comments = new Map<string, number>();
    for (const note of notes) {
        const protectedNote = protectCode(note.markdown);
        const unique = new Set(
            [...protectedNote.text.matchAll(COMMENT)].map((match) =>
                commentKey(protectedNote.restore(match[1] ?? match[2])),
            ),
        );
        for (const key of unique) comments.set(key, (comments.get(key) ?? 0) + 1);
    }
    const resolve = createPathResolver(files, notes);
    const byPath = new Map(notes.map((note) => [note.path, note]));
    const byOriginalId = new Map<string, ImportNote[]>();
    for (const note of notes)
        if (note.originalId) {
            const entries = byOriginalId.get(note.originalId) ?? [];
            entries.push(note);
            byOriginalId.set(note.originalId, entries);
        }
    const assets = files.flatMap((file) => {
        const contentType = imageContentType(file.bytes);
        return contentType ? [{ path: file.path, contentType }] : [];
    });
    const assetPaths = new Set(assets.map((asset) => asset.path));
    const links: ImportPlan['links'] = [];
    const images: ImportPlan['images'] = [];
    const usedFiles = new Set([...notes.map((note) => note.path), ...notion.consumed]);
    const propertyValues = new Map<string, { values: string[]; list: boolean }>();
    const allTags = new Set<string>();
    const disabledTags = new Set(options.disabledTags ?? []);
    for (const note of notes) {
        let restoreSource = (value: string) => value;
        const report = (kind: string, value: string, reason: string) =>
            issues.push({ kind, path: note.path, value: restoreSource(value), reason: restoreSource(reason) });
        const count = (kind: string, action: keyof SyntaxCount = 'changed', amount = 1) =>
            recordSyntax(syntax, kind, action, amount);
        const diagnostics = { report, count };
        for (const match of note.markdown.matchAll(/\[([^\]]*)\]\(ocean-import-note:([^\s)]+)\)/g))
            links.push({ from: note.path, to: decodePath(match[2]), label: match[1] });
        collectImportProperties(note, options, propertyValues, diagnostics);
        const code = protectCode(note.markdown);
        restoreSource = code.restore;
        let text = code.text;
        text = removeGeneratedFooters(text, diagnostics);
        countRetainedSyntax(text, code, diagnostics);
        text = transformNotionAsides(text, note, diagnostics);
        text = transformComments(text, comments, code, diagnostics);
        text = transformCallouts(text, diagnostics);
        text = transformFootnotesAndBlockIds(text, diagnostics);
        text = transformHtml(text, diagnostics);
        text = transformImportLinks(text, {
            note,
            report,
            count,
            resolve,
            notion,
            byOriginalId,
            byPath,
            assetPaths,
            usedFiles,
            links,
            images,
        });
        text = preserveLiteralHtml(text, diagnostics);
        text = transformTags(text, note, disabledTags, allTags, diagnostics);
        text = transformLineBreaks(text, options, obsidian, diagnostics);
        note.markdown = code.restore(text);
    }
    for (const file of files)
        if (!usedFiles.has(file.path))
            issues.push({
                kind: 'skipped-file',
                path: file.path,
                value: file.path,
                reason: assetPaths.has(file.path)
                    ? 'unreferenced image'
                    : 'not a Markdown note or referenced supported image',
            });
    const oversized = new Set<string>();
    const importedNotes = notes.filter((note) => {
        const bytes = importJsonBytes({ path: note.path, markdown: note.markdown, properties: note.properties });
        if (note.markdown.length <= IMPORT_MARKDOWN_CHARS && bytes <= IMPORT_REQUEST_BYTES) return true;
        oversized.add(note.path);
        issues.push({
            kind: 'oversized-note',
            path: note.path,
            value: note.title,
            reason: `Not imported: ${bytes} UTF-8 JSON bytes or ${note.markdown.length} characters exceeds the per-note request limit. Split this Markdown file.`,
        });
        recordSyntax(syntax, 'oversized-note', 'dropped');
        return false;
    });
    for (const link of links.filter((link) => !oversized.has(link.from) && oversized.has(link.to)))
        issues.push({
            kind: 'link-target-skipped',
            path: link.from,
            value: link.to,
            reason: 'Destination exceeds the per-note request limit; link label retained.',
        });
    const titles = new Map<string, number>();
    for (const note of importedNotes) titles.set(note.title, (titles.get(note.title) ?? 0) + 1);
    return {
        files,
        notes: importedNotes,
        assets: assets.filter(
            (asset) =>
                usedFiles.has(asset.path) && importedNotes.some((note) => note.markdown.includes(assetUrl(asset.path))),
        ),
        issues,
        syntax,
        obsidian,
        links: links.filter((link) => !oversized.has(link.from) && !oversized.has(link.to)),
        images: images.filter((image) => !oversized.has(image.from)),
        tags: [...allTags].sort(),
        duplicateTitles: [...titles].filter(([, count]) => count > 1).map(([title, count]) => ({ title, count })),
        properties: [...propertyValues].map(([name, entry]) => ({
            name,
            values: [...new Set(entry.values)],
            list: entry.list,
            valueType: entry.list ? 'text' : recommendPropertyType(entry.values),
            defaultOff: TOOL_PROPERTIES.has(name),
        })),
    };
}

export function renderImportMarkdown(note: ImportNote, ids: Record<string, string>, imageUrls: Record<string, string>) {
    const code = protectCode(note.markdown);
    return code.restore(
        transformMarkdownLinks(code.text, ({ raw, label, target, image, title }) => {
            if (target.startsWith('ocean-import-note:')) {
                const path = decodePath(target.slice('ocean-import-note:'.length));
                if (!ids[path]) return label;
                return `[[${label}]](note:${ids[path]})`;
            }
            if (target.startsWith('ocean-import-asset:')) {
                const path = decodePath(target.slice('ocean-import-asset:'.length));
                const hint = image && title && /^ocean-import-width:\d+$/.test(title) ? ` "${title}"` : '';
                return imageUrls[path]
                    ? `${image ? '!' : ''}[${label}](${imageUrls[path]}${hint})`
                    : label || basename(path);
            }
            return raw;
        }),
    );
}

export function createImportIndex(notes: ImportNote[], ids: Record<string, string>) {
    const output: string[] = [];
    let previous: string[] = [];
    for (const note of [...notes].sort((a, b) => a.path.localeCompare(b.path))) {
        const folders = dirname(note.path).split('/').filter(Boolean);
        let common = 0;
        while (common < folders.length && previous[common] === folders[common]) common++;
        for (let index = common; index < folders.length; index++)
            output.push(
                `${'  '.repeat(index)}- ${cleanNotionName(folders[index]).replace(/ [a-f\d]{4}-[a-f\d]{4}$/i, '')}`,
            );
        output.push(`${'  '.repeat(folders.length)}- [[${escapeLabel(note.title)}]](note:${ids[note.path]})`);
        previous = folders;
    }
    return output.join('\n');
}

export function createImportIndexTitle(sourceName: string, now = new Date()) {
    const source =
        sourceName
            .replace(/[\r\n\t]/g, ' ')
            .trim()
            .slice(0, 180) || 'Markdown';
    const pad = (value: number) => String(value).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return `Import — ${source} — ${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
