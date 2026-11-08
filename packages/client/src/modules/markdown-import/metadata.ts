import type { MetadataValue, PropertyType } from './types';

export const TOOL_PROPERTIES = new Set(['publish', 'permalink', 'cssclasses', 'cssclass', 'mobile']);
export const EXPORT_PROPERTIES = new Set(['note_id', 'workspace_id', 'workspace_name', 'source']);

const unquote = (value: string) => {
    if (value.startsWith('"') && value.endsWith('"')) {
        try {
            return String(JSON.parse(value));
        } catch {
            return value.slice(1, -1);
        }
    }
    return value.replace(/^'(.*)'$/s, (_, content: string) => content.replace(/''/g, "'"));
};

// A conservative YAML subset: unfamiliar nested values remain literal text, never disappear.
export function parseFrontmatter(text: string) {
    const match = /^\uFEFF?---\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(text);
    const properties: Record<string, MetadataValue> = Object.create(null);
    const unparsed: string[] = [];
    if (!match) return { body: text.replace(/^\uFEFF/, ''), properties, unparsed };
    const lines = match[1].split('\n');
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (!line.trim()) continue;
        if (/^\s*#/.test(line)) {
            unparsed.push(line);
            continue;
        }
        const field = /^([^\s:#][^:]*):(?:[ \t]+(.*)|[ \t]*)$/.exec(line);
        if (!field) {
            unparsed.push(line);
            continue;
        }
        const key = unquote(field[1].trim());
        if (key in properties) {
            unparsed.push(line);
            continue;
        }
        let raw = (field[2] ?? '').trim();
        const following: string[] = [];
        while (index + 1 < lines.length && /^(?:\s+|\s*-\s)/.test(lines[index + 1])) {
            following.push(lines[++index]);
        }
        if (!raw && following.every((item) => /^\s*-\s/.test(item))) {
            properties[key] = following.map((item) => unquote(item.replace(/^\s*-\s*/, '').trim())).filter(Boolean);
        } else if (/^\[.*\]$/.test(raw)) {
            properties[key] = (raw.slice(1, -1).match(/(?:"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|[^,])+/g) ?? [])
                .map((item) => unquote(item.trim()))
                .filter(Boolean);
        } else {
            if (/^[>|][-+]?$/.test(raw))
                raw = following.map((item) => item.trimStart()).join(raw[0] === '>' ? ' ' : '\n');
            else if (following.length) raw = [raw, ...following].filter(Boolean).join('\n');
            properties[key] = unquote(raw);
        }
    }
    return { body: text.slice(match[0].length), properties, unparsed };
}

export const asList = (value?: MetadataValue) =>
    (Array.isArray(value) ? value : value ? [value] : []).map((item) => item.trim()).filter(Boolean);

export const parseImportDate = (value: string | undefined) => {
    if (!value || !/^(?:\d{4}-\d{2}-\d{2}|[A-Za-z]+ \d{1,2}, \d{4})/.test(value)) return undefined;
    const english = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(value);
    const date = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : english ? `${value} 00:00:00 GMT` : value,
    );
    const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (
        day &&
        new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))).toISOString().slice(0, 10) !== day[0]
    )
        return undefined;
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export function recommendPropertyType(values: string[]): PropertyType {
    if (!values.length) return 'text';
    if (values.every((value) => value === 'true' || value === 'false')) return 'boolean';
    if (values.every((value) => /^[-+]?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)))) return 'number';
    if (values.every((value) => Boolean(parseImportDate(value)))) return 'date';
    if (values.every((value) => /^https?:\/\/\S+$/.test(value))) return 'url';
    const unique = new Set(values);
    if (
        unique.size <= 20 &&
        unique.size < values.length &&
        values.every((value) => value.length < 80 && !value.includes('\n'))
    )
        return 'select';
    return 'text';
}

export function normalizePropertyValue(value: MetadataValue, type: PropertyType) {
    const text = Array.isArray(value) ? value.join(', ') : value;
    return type === 'date' ? (parseImportDate(text)?.slice(0, 10) ?? text) : text;
}
