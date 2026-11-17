import { analyzeImport, normalizePropertyValue, parseImportDate, renderImportMarkdown } from './index';
import { parseCsv } from './notion';

const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const rowId = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

it('imports Notion CSV rows as properties and gives the CSV a linked database note', () => {
    const csv = `Tasks ${id}_all.csv`;
    const page = `Tasks/Decision ${rowId}.md`;
    const plan = analyzeImport([
        { path: 'Index.md', text: `[Database](Tasks%20${id}_all.csv)` },
        {
            path: csv,
            text: '\uFEFFName,Status,Due date,Details\nDecision,Done,"October 26, 2026","line one\nline two"\n',
        },
        { path: page, text: '# Decision\n\nStatus: Done\nDue date: October 26, 2026\n\nWritten decision.' },
    ]);

    expect(plan.notes).toHaveLength(3);
    expect(plan.notes.find((note) => note.path === page)?.properties).toEqual({
        Name: 'Decision',
        Status: 'Done',
        'Due date': 'October 26, 2026',
        Details: 'line one\nline two',
    });
    expect(plan.notes.find((note) => note.path === page)?.markdown).toBe('Written decision.');
    expect(plan.properties.find((property) => property.name === 'Due date')?.valueType).toBe('date');
    expect(renderImportMarkdown(plan.notes[0], { [csv]: '8' }, {})).toBe('[[Database]](note:8)');
    expect(plan.links.some((link) => link.to === page)).toBe(true);
});

it('merges matching CSV data into the existing database page and drops view settings', () => {
    const plan = analyzeImport([
        {
            path: `People ${id}.md`,
            text: `# People\n\n[Table](People%20${id}_all.csv)\n\nfilters: \nMembership\nsort: \nName: ascending`,
        },
        { path: `People ${id}_all.csv`, text: 'Name,Membership\nAda,Owner' },
        { path: `People/Ada ${rowId}.md`, text: '# Ada\n\nMembership: Owner' },
    ]);

    expect(plan.notes).toHaveLength(2);
    expect(plan.notes[0].markdown).not.toContain('ascending');
    expect(plan.notes[0].properties).toEqual({});
    expect(plan.issues.filter((issue) => issue.kind === 'notion-view-settings')).toHaveLength(2);
    expect(plan.issues.filter((issue) => issue.kind === 'csv-metadata-consumed')).toHaveLength(1);
    expect(plan.links.some((link) => link.from === plan.notes[0].path && link.to === plan.notes[0].path)).toBe(false);
    expect(plan.notes[0].markdown).toContain('Table');
    expect(plan.issues.filter((issue) => issue.kind === 'notion-self-link')).toHaveLength(1);
});

it('preserves unique aside text and counts missing mentions without inventing their target', () => {
    const plan = analyzeImport([
        {
            path: `Decision ${id}.md`,
            text: '# Decision\n\n<aside>\n<img src="https://app.notion.com/icons/notion_gray.svg" alt="Icon" />\n**Choice**\nKeep this. ‣\n</aside>',
        },
    ]);

    expect(plan.notes[0].markdown).toContain('> **Note**  \n');
    expect(plan.notes[0].markdown).toContain('> Keep this. ‣');
    expect(plan.notes[0].markdown).not.toContain('notion_gray.svg');
    expect(plan.issues.find((issue) => issue.kind === 'notion-missing-mention')?.value).toBe('1');
});

it('does not interpret ordinary Markdown key/value prose as Notion row properties', () => {
    const plan = analyzeImport([
        { path: 'Decision.md', text: 'Purpose: Keep this as prose.\n\nStatus: authored paragraph.' },
    ]);

    expect(plan.notes[0].properties).toEqual({});
    expect(plan.notes[0].markdown).toContain('Purpose: Keep this as prose.');
});

it('keeps opening key/value prose on Notion pages that are not database rows', () => {
    const plan = analyzeImport([
        { path: `Plan ${id}.md`, text: '# Plan\n\nTODO: buy milk\nhttps://example.com\n\nRest' },
    ]);

    expect(plan.notes[0].properties).toEqual({});
    expect(plan.notes[0].markdown).toBe('TODO: buy milk\nhttps://example.com\n\nRest');
});

it('takes only database columns from a row page and keeps the following body text', () => {
    const page = `Tasks/Decision ${rowId}.md`;
    const plan = analyzeImport([
        { path: `Tasks ${id}_all.csv`, text: 'Name,Status\nDecision,Done\n' },
        { path: page, text: '# Decision\n\nStatus: Done\nNote: call Ada first' },
    ]);

    const row = plan.notes.find((note) => note.path === page);
    expect(row?.properties).toEqual({ Name: 'Decision', Status: 'Done' });
    expect(row?.markdown).toBe('Note: call Ada first');
});

it('matches row pages in a database folder named with the full Notion ID', () => {
    const page = `Habits ${id}/@December 4, 2024 ${rowId}.md`;
    const plan = analyzeImport([
        {
            path: `Habits ${id}_all.csv`,
            text: '\uFEFFDate,Ran today,Full date\n"@December 4, 2024 ",No,"December 4, 2024 8:45 AM"\n',
        },
        { path: page, text: '# @December 4, 2024\n\nRan today: No\nFull date: December 4, 2024 8:45 AM' },
    ]);

    const row = plan.notes.find((note) => note.path === page);
    expect(row?.properties).toEqual({
        Date: '@December 4, 2024',
        'Ran today': 'No',
        'Full date': 'December 4, 2024 8:45 AM',
    });
    expect(row?.markdown).toBe('');
    expect(plan.issues.some((issue) => issue.kind === 'csv-row-unmatched')).toBe(false);
});

it('parses BOM, commas, quotes and multiline CSV values', () => {
    expect(parseCsv('\uFEFFName,Text\r\nA,"say ""yes"",\nand continue"\r\n')).toEqual([
        ['Name', 'Text'],
        ['A', 'say "yes",\nand continue'],
    ]);
});

it('interprets English calendar dates without a timezone-dependent day shift', () => {
    expect(parseImportDate('October 26, 2026')).toBe('2026-10-26T00:00:00.000Z');
    expect(parseImportDate('2025-02-31')).toBeUndefined();
});

it('stores date property values as the calendar day written in the source', () => {
    expect(normalizePropertyValue('2024-01-15', 'date')).toBe('2024-01-15');
    expect(normalizePropertyValue('2024-01-15T01:00:00+09:00', 'date')).toBe('2024-01-15');
    expect(normalizePropertyValue('2024-01-15T23:30:00-05:00', 'date')).toBe('2024-01-15');
    expect(normalizePropertyValue('January 15, 2024 8:00 AM', 'date')).toBe('2024-01-15');
    expect(normalizePropertyValue('not a date', 'date')).toBe('not a date');
});

it('keeps backslashes, pipes and brackets inside their CSV table cells', () => {
    const plan = analyzeImport([
        { path: `Paths ${id}_all.csv`, text: 'Name,Location\n[Draft] notes,"C:\\temp|logs"\n' },
    ]);

    expect(plan.notes[0].markdown).toContain('| \\[Draft\\] notes | C:\\\\temp\\|logs |');
});
