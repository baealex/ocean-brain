import { analyzeImport, parseImportDate, renderImportMarkdown } from './index';
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
