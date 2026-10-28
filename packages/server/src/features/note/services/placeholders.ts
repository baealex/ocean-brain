import models, { type Prisma } from '~/models.js';

interface PlaceholderRecord {
    template: string;
    replacement: string;
}

const fixedValues = (date: Date): Record<string, string> => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const hour = date.getHours();
    const hour12 = hour % 12 || 12;
    return {
        year: String(date.getFullYear()),
        month: pad(date.getMonth() + 1),
        mon: String(date.getMonth() + 1),
        day: pad(date.getDate()),
        d: String(date.getDate()),
        week_of_month: String(
            Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7),
        ),
        hour: pad(hour),
        h: String(hour),
        hour_12: pad(hour12),
        h_12: String(hour12),
        ampm: hour < 12 ? 'AM' : 'PM',
        minute: pad(date.getMinutes()),
        m: String(date.getMinutes()),
        second: pad(date.getSeconds()),
        s: String(date.getSeconds()),
    };
};

type FindPlaceholders = (templates: string[]) => Promise<PlaceholderRecord[]>;

const loadReplacements = async (values: string[], find: FindPlaceholders) => {
    const templates = [
        ...new Set(values.flatMap((value) => Array.from(value.matchAll(/\{%([^{}]+)%\}/g), (match) => match[1]))),
    ];
    const records = templates.length ? await find(templates) : [];
    const replacements = new Map([
        ...records.map((item): [string, string] => [item.template, item.replacement]),
        ...Object.entries(fixedValues(new Date())),
    ]);
    return (value: string) => value.replace(/\{%([^{}]+)%\}/g, (match, key) => replacements.get(key) ?? match);
};

export const createPlaceholderReplacer = (find: FindPlaceholders) => async (value: string) =>
    (await loadReplacements([value], find))(value);

const findPlaceholders =
    (db: typeof models | Prisma.TransactionClient): FindPlaceholders =>
    (templates) =>
        db.placeholder.findMany({ where: { template: { in: templates } } });

export const notePlaceholderReplacer = (db: typeof models | Prisma.TransactionClient = models) =>
    createPlaceholderReplacer(findPlaceholders(db));

// Resolve once, then replace decoded strings so quotes and replacement tokens stay literal JSON text.
export const replaceContentPlaceholders = async (
    content: string,
    db: typeof models | Prisma.TransactionClient = models,
) => {
    if (!content || !content.includes('{%')) return content;
    const strings: string[] = [];
    const parsed: unknown = JSON.parse(content, (_key, value: unknown) => {
        if (typeof value === 'string') strings.push(value);
        return value;
    });
    const replace = await loadReplacements(strings, findPlaceholders(db));
    return JSON.stringify(parsed, (_key, value: unknown) => (typeof value === 'string' ? replace(value) : value));
};
