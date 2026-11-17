import type { ImportFile, ImportNote } from './types';

export const decodePath = (value: string) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};
export function normalizePath(value: string): string {
    const parts: string[] = [];
    for (const part of value.normalize('NFC').replace(/\\/g, '/').split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (parts.length) parts.pop();
            else return `../${value}`;
        } else parts.push(part);
    }
    return parts.join('/');
}

/** Browser folder picks and wrapped zips include the selected directory in every entry. */
export function stripCommonImportRoot(files: ImportFile[]): ImportFile[] {
    const normalized = files.map((file) => ({ ...file, path: normalizePath(file.path) }));
    const first = normalized[0]?.path.split('/');
    const root = first?.[0];
    if (!root || root === '..' || root.startsWith('.') || !normalized.every((file) => file.path.startsWith(`${root}/`)))
        return normalized;
    return normalized.map((file) => ({ ...file, path: file.path.slice(root.length + 1) }));
}
export const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);
export const dirname = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
export const withoutMarkdown = (path: string) => path.replace(/\.md$/i, '');
export const cleanNotionName = (value: string) => value.replace(/ [a-f\d]{32}(?=(?:_all)?(?:\.[^.]+)?$)/i, '');

export function createPathResolver(files: ImportFile[], notes: ImportNote[]) {
    const exact = new Map(files.map((file) => [file.path, file.path]));
    const insensitive = new Map<string, string[]>();
    const names = new Map<string, string[]>();
    const namesInsensitive = new Map<string, string[]>();
    const add = (map: Map<string, string[]>, key: string, path: string) => {
        const entries = map.get(key) ?? [];
        if (!entries.includes(path)) entries.push(path);
        map.set(key, entries);
    };
    for (const file of files) {
        add(insensitive, file.path.toLowerCase(), file.path);
        add(names, withoutMarkdown(basename(file.path)), file.path);
        add(namesInsensitive, withoutMarkdown(basename(file.path)).toLowerCase(), file.path);
    }
    for (const note of notes) {
        for (const alias of [...note.aliases, note.title]) {
            add(names, alias.normalize('NFC'), note.path);
            add(namesInsensitive, alias.normalize('NFC').toLowerCase(), note.path);
        }
    }
    const nearest = (hits: string[], from: string) => {
        const folder = dirname(from).split('/').filter(Boolean);
        const distance = (path: string) => {
            const target = dirname(path).split('/').filter(Boolean);
            let common = 0;
            while (common < folder.length && folder[common] === target[common]) common++;
            return folder.length + target.length - 2 * common;
        };
        const sorted = [...new Set(hits)].sort((a, b) => distance(a) - distance(b) || a.localeCompare(b));
        if (sorted.length > 1 && distance(sorted[0]) === distance(sorted[1]))
            return { reason: 'ambiguous equally near paths', candidates: sorted };
        return { path: sorted[0] };
    };
    return (raw: string, from: string, relative = false): { path?: string; reason?: string; candidates?: string[] } => {
        const target = decodePath(raw)
            .normalize('NFC')
            .replace(/\\([ ()])/g, '$1');
        const root = normalizePath(target);
        const local = normalizePath(`${dirname(from)}/${target}`);
        const paths = relative ? [local, root] : [root, local];
        for (const path of paths) {
            for (const candidate of [path, `${path}.md`]) if (exact.has(candidate)) return { path: candidate };
        }
        const key = withoutMarkdown(basename(root));
        let hits = names.get(key);
        if (hits?.length) return nearest(hits, from);
        for (const path of paths) {
            hits = insensitive.get(path.toLowerCase()) ?? insensitive.get(`${path}.md`.toLowerCase());
            if (hits?.length) return nearest(hits, from);
        }
        hits = namesInsensitive.get(key.toLowerCase());
        if (hits?.length) return nearest(hits, from);
        return { reason: 'target not present in selected files' };
    };
}

/** Match the existing upload API's accepted formats, including extensionless Notion attachments. */
export function imageContentType(bytes?: Uint8Array): string | undefined {
    if (!bytes) return undefined;
    const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
    if (bytes.length >= 8 && starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png';
    if (bytes.length >= 3 && starts(255, 216, 255)) return 'image/jpeg';
    if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'image/gif';
    if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
    if (bytes.length >= 2 && ascii(0, 2) === 'BM') return 'image/bmp';
    if (bytes.length >= 16 && ascii(4, 8) === 'ftyp') {
        const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
        if (size !== 0 && (size < 16 || size > bytes.length)) return undefined;
        if (['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
        for (let offset = 16; offset + 4 <= (size || bytes.length); offset += 4)
            if (['avif', 'avis'].includes(ascii(offset, offset + 4))) return 'image/avif';
    }
    return undefined;
}
