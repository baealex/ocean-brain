import { ensureTagByName } from '~/features/tag/services/organization.js';
import { markdownToBlocksJson } from '~/modules/blocknote.js';

type Reference = { id: string; title: string };

/** Import-only preprocessing. The existing converter canonicalizes reference labels to current titles.
 * Opaque prose tokens retain the author's aliases, then become ordinary reference inlines.
 * Code is opaque, so syntax examples never become links or tags. */
export async function importMarkdownToBlocksJson(
    markdown: string,
    references: Map<string, Reference>,
    ensureTag: (
        name: string,
    ) => Promise<{ id: string; name: string } | { tag: { id: string; name: string } }> = ensureTagByName,
) {
    const tokens = new Map<string, Reference & { raw: string }>();
    const imageWidths = new Map<string, Array<number | undefined>>();
    let inlineTicks: string | undefined;
    const imageHints = (line: string) => {
        if (!line.trim()) inlineTicks = undefined;
        const rewrite = (text: string) =>
            inlineTicks
                ? text
                : text.replace(
                      /!\[(?:\\.|[^\]\n])*\]\(([^\s)]+)(?: "ocean-import-width:(\d+)")?\)/g,
                      (raw, url: string, width: string | undefined) => {
                          const sizes = imageWidths.get(url) ?? [];
                          sizes.push(width ? Number(width) : undefined);
                          imageWidths.set(url, sizes);
                          return width ? raw.replace(` "ocean-import-width:${width}"`, '') : raw;
                      },
                  );
        let output = '';
        let cursor = 0;
        for (const match of line.matchAll(/`+/g)) {
            const index = match.index!;
            output += rewrite(line.slice(cursor, index)) + match[0];
            let slash = index;
            while (line[slash - 1] === '\\') slash--;
            if ((index - slash) % 2 === 0)
                inlineTicks = inlineTicks === match[0] ? undefined : (inlineTicks ?? match[0]);
            cursor = index + match[0].length;
        }
        return output + rewrite(line.slice(cursor));
    };
    let fence: string | undefined;
    let listContentIndent: number | undefined;
    let sequence = 0;
    const prefix = `OBIMPORT${Array.from(markdown).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0)}REF`;
    const source = markdown
        .split('\n')
        .map((line) => {
            const list = /^(\s*)(?:[-*+]|\d+[.)])\s+/.exec(line);
            if (list) listContentIndent = list[0].length;
            else if (line.trim() && !/^\s|^>/.test(line)) listContentIndent = undefined;
            const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
            if (fence) {
                if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim())
                    fence = undefined;
                return line;
            }
            if (match) {
                fence = match[1];
                return line;
            }
            if (
                /^(?: {4}|\t)/.test(line) &&
                (listContentIndent === undefined || (line.match(/^ */)?.[0].length ?? 0) >= listContentIndent + 4)
            )
                return line;
            const images = imageHints(line);
            return images.replace(
                /`+[^`]*`+|\[\[((?:\\.|[^\]])*)\]\]\(note:([1-9]\d*)\)/g,
                (raw, label: string | undefined, id: string | undefined) => {
                    if (!id || label === undefined) return raw;
                    if (!references.has(id)) return raw;
                    const token = `${prefix}${sequence++}END`;
                    tokens.set(token, { id, title: label.replace(/\\([|[\]\\])/g, '$1').replace(/`/g, ''), raw });
                    return token;
                },
            );
        })
        .join('\n');
    const content = await markdownToBlocksJson(source, {
        ensureTag,
        findNotesByTitle: async () => [],
        findNoteById: async () => null,
    });
    const restore = (value: unknown): unknown => {
        if (Array.isArray(value))
            return value.flatMap((child) => {
                if (child && typeof child === 'object' && child.type === 'text' && typeof child.text === 'string') {
                    const output: unknown[] = [];
                    const pattern = new RegExp(`(${prefix}\\d+END)`, 'g');
                    for (const part of child.text.split(pattern)) {
                        const reference = tokens.get(part);
                        if (reference) {
                            if (child.styles?.code) {
                                output.push({ ...child, text: reference.raw });
                                continue;
                            }
                            const canonical = references.get(reference.id)!;
                            if (reference.title !== canonical.title)
                                output.push({ ...child, text: `${reference.title} (` });
                            output.push({ type: 'reference', props: canonical });
                            if (reference.title !== canonical.title) output.push({ ...child, text: ')' });
                        } else if (part) output.push({ ...child, text: part });
                    }
                    return output;
                }
                return [restore(child)];
            });
        if (value && typeof value === 'object') {
            const block = value as { type?: string; props?: { url?: string } };
            if (block.type === 'image' && block.props?.url) {
                const width = imageWidths.get(block.props.url)?.shift();
                if (width && Number.isFinite(width))
                    return { ...block, props: { ...block.props, previewWidth: width } };
            }
            return Object.fromEntries(
                Object.entries(value).map(([key, child]) => [key, key === 'props' ? child : restore(child)]),
            );
        }
        return value;
    };
    return JSON.stringify(restore(JSON.parse(content)));
}
