import { asList } from './metadata';
import { basename, dirname } from './paths';
import { type ImportFile, type ImportIssue, type ImportNote, recordSyntax, type SyntaxCount } from './types';

/** RFC 4180 fields, including BOM, escaped quotes and embedded newlines. */
export function parseCsv(source: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '"') {
            if (quoted && text[index + 1] === '"') {
                cell += '"';
                index++;
            } else if (!cell || quoted) quoted = !quoted;
            else cell += char;
        } else if (char === ',' && !quoted) {
            row.push(cell);
            cell = '';
        } else if (char === '\n' && !quoted) {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else cell += char;
    }
    if (quoted) throw new Error('Unclosed quoted CSV field');
    if (cell || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

const notionId = (path: string) => / ([a-f\d]{32})(?:_all)?\.(?:md|csv)$/i.exec(path)?.[1].toLowerCase();
const cellText = (value: string) => value.replace(/[\\|[\]]/g, '\\$&').replace(/\n/g, ' / ');

export function prepareNotion(
    files: ImportFile[],
    notes: ImportNote[],
    issues: ImportIssue[],
    syntax: Record<string, SyntaxCount>,
) {
    const csvTargets = new Map<string, string>();
    const consumed = new Set<string>();
    for (const note of notes) {
        if (!notionId(note.path)) continue;
        // Export row metadata is only the initial contiguous key/value block after the H1.
        const heading = /^\s*# [^\n]+\n\s*\n/.exec(note.markdown);
        const offset = heading?.[0].length ?? 0;
        const body = note.markdown.slice(offset);
        const match = /^(?:[^\n:#<>]+:[ \t]*[^\n]*(?:\n|$))+/.exec(body);
        if (match && !/^(?:filters|sort):/.test(match[0])) {
            const lines = match[0].trimEnd().split('\n');
            for (const line of lines) {
                const colon = line.indexOf(':');
                const key = line.slice(0, colon).trim();
                const value = line.slice(colon + 1).trim();
                if (/^(filters|sort)$/.test(key)) continue;
                if (value) note.properties[key] = value;
                else
                    issues.push({
                        kind: 'empty-property',
                        path: note.path,
                        value: key,
                        reason: 'empty Notion row value',
                    });
                recordSyntax(syntax, 'notion-row-property', 'changed');
            }
            // Do not eat view settings with the row metadata matcher.
            if (!lines.some((line) => /^(?:filters|sort):/.test(line)))
                note.markdown = note.markdown.slice(0, offset) + body.slice(match[0].length).replace(/^\n/, '');
        }
        note.markdown = note.markdown.replace(
            /^(?:filters|sort):[^\n]*(?:\n(?!\n|(?:filters|sort):)[^\n]+)*/gm,
            (raw) => {
                issues.push({
                    kind: 'notion-view-settings',
                    path: note.path,
                    value: raw,
                    reason: 'exported database view configuration',
                });
                recordSyntax(syntax, 'notion-view-settings', 'dropped');
                return '';
            },
        );
    }
    for (const file of files.filter((file) => / [a-f\d]{32}_all\.csv$/i.test(file.path) && file.text !== undefined)) {
        const id = notionId(file.path)!;
        const name = basename(file.path).replace(/ [a-f\d]{32}_all\.csv$/i, '');
        let rows: string[][];
        try {
            rows = parseCsv(file.text!);
        } catch (error) {
            issues.push({ kind: 'invalid-csv', path: file.path, value: file.path, reason: String(error) });
            continue;
        }
        if (!rows.length || rows[0].length < 1) {
            issues.push({ kind: 'empty-csv', path: file.path, value: file.path, reason: 'no CSV columns' });
            continue;
        }
        const [headers, ...values] = rows;
        const folders = [
            `${dirname(file.path)}/${name}`,
            `${dirname(file.path)}/${name} ${id.slice(0, 4)}-${id.slice(-4)}`,
        ].map((folder) => folder.replace(/^\//, ''));
        const candidates = notes.filter((note) => folders.includes(dirname(note.path)));
        const usedRows = new Set<string>();
        const table: string[] = [
            `| ${headers.map(cellText).join(' | ')} |`,
            `| ${headers.map(() => '---').join(' | ')} |`,
        ];
        for (const row of values) {
            const title = row[0]?.trim() ?? '';
            let matches = candidates.filter(
                (note) =>
                    !usedRows.has(note.path) && (note.title === title || (!title && /^untitled$/i.test(note.title))),
            );
            if (matches.length > 1)
                matches = matches.filter((note) =>
                    headers
                        .slice(1)
                        .every(
                            (key, index) =>
                                !row[index + 1]?.trim() ||
                                asList(note.properties[key]).join(', ') === row[index + 1].trim(),
                        ),
                );
            const found = matches.length === 1 ? matches[0] : undefined;
            if (found) {
                usedRows.add(found.path);
                for (let index = 0; index < headers.length; index++) {
                    const key = headers[index].trim();
                    const value = row[index]?.trim();
                    if (key && value && !asList(found.properties[key]).length) found.properties[key] = value;
                }
            } else
                issues.push({
                    kind: 'csv-row-unmatched',
                    path: file.path,
                    value: title || '(untitled row)',
                    reason: matches.length
                        ? 'multiple matching row pages; CSV text retained in table'
                        : 'row page absent; CSV text retained in table',
                });
            if (row.length !== headers.length)
                issues.push({
                    kind: 'csv-column-count',
                    path: file.path,
                    value: row.join(', '),
                    reason: 'row width differs from headers; full row retained',
                });
            table.push(
                `| ${row.map((value, index) => (index === 0 && found ? `[${cellText(value || found.title)}](ocean-import-note:${encodeURIComponent(found.path)})` : cellText(value))).join(' | ')} |`,
            );
            recordSyntax(syntax, 'notion-csv-row', 'changed');
        }
        let target = notes.find((note) => /\.md$/i.test(note.path) && notionId(note.path) === id);
        if (!target) {
            target = {
                path: file.path,
                title: name,
                markdown: table.join('\n'),
                aliases: [],
                tags: [],
                properties: {},
            };
            notes.push(target);
        } else {
            target.markdown += `\n\n${table.join('\n')}`;
            issues.push({
                kind: 'csv-metadata-consumed',
                path: file.path,
                value: file.path,
                reason: 'rows and properties merged into the matching database note',
            });
        }
        csvTargets.set(file.path, target.path);
        consumed.add(file.path);
    }
    return { csvTargets, consumed };
}

export const isNotionPage = (path: string) => Boolean(notionId(path));
