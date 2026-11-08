import { analyzeImport, createImportIndex, createImportIndexTitle, renderImportMarkdown } from './index';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe('Markdown import preprocessing', () => {
    it('converts standard Markdown links with bracketed prefixes in their labels', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '[[Flag] Chosen decision](B.md)' },
            { path: 'B.md', text: 'Destination' },
        ]);

        expect(plan.links).toEqual([{ from: 'A.md', to: 'B.md', label: '[Flag] Chosen decision' }]);
    });
    it('cleans Notion folder IDs in contents and identifies the source and import time', () => {
        const plan = analyzeImport([{ path: 'Budget abcd-1234/Choice.md', text: 'Decision' }]);

        const index = createImportIndex(plan.notes, { 'Budget abcd-1234/Choice.md': '1' });

        expect(index).toContain('- Budget\n');
        expect(index).not.toContain('abcd-1234');
        expect(createImportIndexTitle('My notes.zip', new Date(2026, 10, 8, 1, 2, 3))).toBe(
            'Import — My notes.zip — 2026-11-08 01:02',
        );
    });
    it('keeps image descriptions in table cells while placing images after the complete table', () => {
        const plan = analyzeImport([
            {
                path: 'A.md',
                text: '| Item | Preview |\n| --- | --- |\n| First | ![Chosen](photo.png) |\n| Second | ![](photo.png) |',
            },
            { path: 'photo.png', bytes: png },
        ]);

        expect(plan.notes[0].markdown).toContain('| First | Chosen |\n| Second | photo.png |');
        expect(plan.images).toHaveLength(2);
        expect(plan.notes[0].markdown.indexOf('![Chosen]')).toBeGreaterThan(plan.notes[0].markdown.indexOf('| Second'));
    });
    it.each(['100', '100x200'])('uses a numeric image alias as a width hint: %s', (hint) => {
        const plan = analyzeImport([
            { path: 'A.md', text: `![[photo.png|${hint}]]` },
            { path: 'photo.png', bytes: png },
        ]);

        const rendered = renderImportMarkdown(plan.notes[0], {}, { 'photo.png': '/assets/images/photo.png' });

        expect(rendered).toContain('![photo.png](/assets/images/photo.png "ocean-import-width:100")');
        expect(plan.syntax['image-size-hint'].changed).toBe(1);
    });
    it('reports oversized notes in preview while retaining the other notes and link labels', () => {
        const plan = analyzeImport([
            { path: 'Large.md', text: '가'.repeat(300_000) },
            { path: 'Small.md', text: 'Keep [[Large|the decision]] and this text.' },
        ]);

        expect(plan.notes.map((note) => note.path)).toEqual(['Small.md']);
        expect(plan.issues).toContainEqual(expect.objectContaining({ kind: 'oversized-note', path: 'Large.md' }));
        expect(plan.issues).toContainEqual(expect.objectContaining({ kind: 'link-target-skipped', path: 'Small.md' }));
        expect(renderImportMarkdown(plan.notes[0], { 'Small.md': '1' }, {})).toContain('the decision');
    });
    it('styles only the callout label while preserving authored title markup', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '> [!info] **Chosen** ([[B]]) `code`\n> Body\n\n> [!warning]\n> Another body' },
            { path: 'B.md', text: 'Target' },
        ]);

        expect(plan.notes[0].markdown).toContain(
            '> **Info:** **Chosen** ([B](ocean-import-note:B.md)) `code`  \n> Body',
        );
        expect(plan.notes[0].markdown).toContain('> **Warning**  \n> Another body');
        expect(plan.notes[0].markdown).not.toContain('****');
    });
    it('preserves single line breaks at the same quote depth', () => {
        const plan = analyzeImport([{ path: 'A.md', text: '> First\n> Second\n>\n> > Nested\n> > Next' }], {
            lineBreaks: 'preserve',
        });

        expect(plan.notes[0].markdown).toBe('> First  \n> Second\n>\n> > Nested  \n> > Next');
    });

    it.each(['paragraph', 'preserve'] as const)('breaks after callout titles in %s mode', (lineBreaks) => {
        const plan = analyzeImport([{ path: 'A.md', text: '> [!info] A choice\n> Written body' }], { lineBreaks });

        expect(plan.notes[0].markdown).toMatch(/A choice[^\n]* {2}\n> Written body/);
    });
    it('converts wikilinks before parenthetical prose without exposing code tokens in diagnostics', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '[[B|shortcut]](e.g. `Copy`) [[B]](`config`) [[Missing]](use `Paste`)' },
            { path: 'B.md', text: 'Destination' },
        ]);

        expect(plan.links.map((link) => link.to)).toEqual(['B.md', 'B.md']);
        expect(plan.notes[0].markdown).toContain('[shortcut](ocean-import-note:B.md)(e.g. `Copy`)');
        expect(plan.notes[0].markdown).toContain('[[Missing]](use `Paste`)');
        expect(plan.issues.filter((issue) => issue.kind === 'unresolved-link')).toEqual([
            expect.objectContaining({ value: 'Missing' }),
        ]);
        expect(JSON.stringify(plan.issues)).not.toContain('CODE');
    });

    it('restores inline source text in diagnostic values', () => {
        const plan = analyzeImport([{ path: 'A.md', text: '[[Missing `code`]]' }]);

        expect(plan.issues[0].value).toBe('Missing `code`');
    });
    it.each([
        ['```md\n> [!info] Example\n> Body\n```', '```md\n> [!info] Example\n> Body\n```'],
        ['> ```md\n> > [!info] Example\n> > Body\n> ```', '```md\n> [!info] Example\n> Body\n```'],
        ['> > ```md\n> > > Example\n> > ```', '```md\n> Example\n```'],
    ])('preserves quote markers inside fences after removing only the opening quote depth: %s', (text, expected) => {
        const plan = analyzeImport([{ path: 'Example.md', text }]);

        expect(plan.notes[0].markdown).toBe(expected);
        expect(plan.syntax.callout).toBeUndefined();
    });
    it('uses the first visible H1 for a generic filename even after introductory content', () => {
        const plan = analyzeImport([
            { path: 'README.md', text: 'Introduction.\n\n```md\n# Example\n```\n\n# A chosen title\n\nBody.' },
        ]);

        expect(plan.notes[0].title).toBe('A chosen title');
        expect(plan.notes[0].markdown).toContain('# A chosen title');
    });

    it('does not rewrite links or tags in a multiline inline code span', () => {
        const plan = analyzeImport([{ path: 'A.md', text: '``literal\n[[Example]] #example\n``' }]);

        expect(plan.links).toEqual([]);
        expect(plan.tags).toEqual([]);
        expect(plan.notes[0].markdown).toContain('[[Example]] #example');
    });
    it('keeps an authored source URL while dropping Ocean Brain export identity metadata', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '---\nsource: https://example.com/research\n---\nA decision.' },
        ]);

        expect(plan.notes[0].properties.source).toBe('https://example.com/research');
        expect(plan.issues.some((issue) => issue.kind === 'export-metadata')).toBe(false);
    });
    it('keeps an empty-alt image that links to its own URL', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '[![](https://example.com/photo.png)](https://example.com/photo.png)' },
        ]);

        expect(plan.notes[0].markdown).toContain('\n\n![](https://example.com/photo.png)\n\n');
        expect(plan.notes[0].markdown).not.toContain('[![');
    });

    it('uploads a linked local image and preserves a different click destination', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '[![Choice](pixel.png)](https://example.com/decision)' },
            { path: 'pixel.png', bytes: png },
        ]);

        expect(plan.assets).toHaveLength(1);
        expect(plan.images).toHaveLength(1);
        expect(plan.notes[0].markdown).toContain('[Choice](https://example.com/decision)');
    });
    it('does not classify different authored code inside comments as repeated guidance', () => {
        const plan = analyzeImport(
            ['A', 'B', 'C'].map((name) => ({ path: `${name}.md`, text: `%%Decision: \`${name}\`%%` })),
        );

        expect(plan.issues.filter((issue) => issue.kind === 'repeated-comment')).toHaveLength(0);
        expect(plan.notes[0].markdown).toContain('Decision: `A`');
    });
    it('retains remote images with spaces in their destination as independent blocks', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: 'Before ![preview](<https://example.com/image one.png>) after.' },
        ]);

        expect(plan.notes[0].markdown).toContain('\n\n![preview](https://example.com/image%20one.png)\n\n');
        expect(plan.notes[0].markdown).toContain('Before');
        expect(plan.notes[0].markdown).toContain('after.');
    });
    it('retains prose after an incomplete literal HTML marker', () => {
        const plan = analyzeImport([{ path: 'A.md', text: '# <Writer\n\n## Author of\n\nA chosen theme.' }]);

        expect(plan.notes[0].markdown).toContain('# &lt;Writer');
        expect(plan.notes[0].markdown).toContain('A chosen theme.');
        expect(plan.issues[0].kind).toBe('literal-html-marker');
    });
    it('separates an unsupported inline icon filename from neighboring prose', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '아이콘![[icon.svg#icon]]을 선택하세요.' },
            { path: 'icon.svg', text: '<svg />' },
        ]);

        expect(plan.notes[0].markdown).toContain('아이콘 icon.svg 을 선택하세요.');
        expect(plan.issues.some((issue) => issue.kind === 'unsupported-attachment')).toBe(true);
    });
    it('keeps the entire alias after the first wiki separator', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '[[B|Chosen | Extended decision]]' },
            { path: 'B.md', text: 'Target' },
        ]);

        expect(plan.links[0].label).toBe('Chosen | Extended decision');
        expect(renderImportMarkdown(plan.notes[0], { 'B.md': '10' }, {})).toContain('Chosen \\| Extended decision');
    });

    it('reports generated edit/copy/download footers instead of importing repeated boilerplate', () => {
        const plan = analyzeImport([
            {
                path: 'A.md',
                text: 'Decision\n\n# This note in GitHub\n\n<span class="git-footer">[Edit In GitHub](https://example.com/edit) | [Copy this note](https://example.com/raw)</span>',
            },
        ]);

        expect(plan.notes[0].markdown).toContain('Decision');
        expect(plan.notes[0].markdown).not.toContain('git-footer');
        expect(plan.notes[0].markdown).not.toContain('This note in GitHub');
        expect(plan.issues[0].kind).toBe('generated-footer');
    });
    it('keeps indented fenced code opaque without leaking protection tokens', () => {
        const plan = analyzeImport([
            {
                path: 'A.md',
                text: '1. Example\n\t```json\n    { "note": "[[Not a link]]", "tag": "#not-a-tag" }\n\t```\n2. Keep `written text`.\n\n> ```html\n> <svg width="20"><rect /></svg>\n> ```',
            },
        ]);

        expect(plan.notes[0].markdown).toContain('{ "note": "[[Not a link]]", "tag": "#not-a-tag" }');
        expect(plan.notes[0].markdown).toContain('<svg width="20"><rect /></svg>');
        expect(plan.notes[0].markdown).not.toMatch(/\uE000CODE/);
        expect(plan.links).toEqual([]);
        expect(plan.tags).toEqual([]);
    });

    it('keeps HTML table text without turning indented cells into code', () => {
        const plan = analyzeImport([
            {
                path: 'A.md',
                text: '<table>\n<tr><td>Decision</td>\n    <td style="color:red">Keep this</td></tr>\n</table>',
            },
        ]);

        expect(plan.notes[0].markdown).toContain('Decision');
        expect(plan.notes[0].markdown).toContain('Keep this');
        expect(plan.notes[0].markdown).not.toContain('style=');
    });
    it('resolves wiki variants, aliases, nearest duplicate names and relative links', () => {
        const plan = analyzeImport([
            {
                path: 'one/Start.md',
                text: '[[Target|chosen]] [[Target#Heading]] [[Target#^block]] [[Alias]] [[#Local]] [go](Target.md) ![[Target]]',
            },
            { path: 'one/Target.md', text: '---\naliases: [Alias]\n---\nOne' },
            { path: 'two/Target.md', text: 'Two' },
        ]);

        expect(plan.links).toHaveLength(6);
        expect(plan.links.every((link) => link.to === 'one/Target.md')).toBe(true);
        expect(renderImportMarkdown(plan.notes[0], { 'one/Target.md': '12' }, {})).toContain('[[chosen]](note:12)');
        expect(plan.notes[0].markdown).toContain('Local');
        expect(plan.issues.filter((issue) => issue.kind === 'link-anchor')).toHaveLength(2);
    });

    it('normalizes Korean NFC/NFD and resolves case differences', () => {
        const plan = analyzeImport([
            { path: 'Start.md', text: '[[한글]] [[case]]' },
            { path: `${'한글'.normalize('NFD')}.md`, text: 'Korean' },
            { path: 'Case.md', text: 'Case' },
        ]);

        expect(plan.links.map((link) => link.to)).toEqual(['한글.md', 'Case.md']);
    });

    it('keeps ambiguous and missing links visible with actionable diagnostics', () => {
        const plan = analyzeImport([
            { path: 'Start.md', text: '[[Same]] [[Missing]]' },
            { path: 'a/Same.md', text: 'A' },
            { path: 'b/Same.md', text: 'B' },
        ]);

        expect(plan.notes[0].markdown).toContain('[[Same]] [[Missing]]');
        expect(plan.issues.filter((issue) => issue.kind === 'unresolved-link').map((issue) => issue.reason)).toEqual([
            expect.stringContaining('ambiguous'),
            'target not present in selected files',
        ]);
    });

    it('uploads only supported image bytes and reports every other attachment', () => {
        const plan = analyzeImport([
            { path: 'Start.md', text: '![[picture.png]] ![second](attachment) ![[recording.mp3]] ![[drawing.svg]]' },
            { path: 'picture.png', bytes: png },
            { path: 'attachment', bytes: png },
            { path: 'recording.mp3', bytes: new Uint8Array([1]) },
            { path: 'drawing.svg', text: '<svg/>' },
        ]);

        expect(plan.assets).toHaveLength(2);
        expect(plan.issues.filter((issue) => issue.kind === 'unsupported-attachment')).toHaveLength(2);
        expect(
            renderImportMarkdown(plan.notes[0], {}, { 'picture.png': '/image.png', attachment: '/other.png' }),
        ).toContain('![picture.png](/image.png)');
    });

    it('preserves authored comments and removes comments repeated across three notes', () => {
        const plan = analyzeImport(
            ['A', 'B', 'C'].map((name) => ({
                path: `${name}.md`,
                text: `%%template instruction%%\n%%decision ${name}%%\n\`%%code%% #code\`\n\n\`\`\`md\n[[example]] #example\n\`\`\``,
            })),
        );

        expect(plan.issues.filter((issue) => issue.kind === 'repeated-comment')).toHaveLength(3);
        expect(plan.notes[0].markdown).toContain('> decision A');
        expect(plan.notes[0].markdown).toContain('`%%code%% #code`');
        expect(plan.issues.some((issue) => issue.value === 'example')).toBe(false);
    });

    it('retains callout text, footnotes and HTML links while reporting removed markers', () => {
        const plan = analyzeImport([
            {
                path: 'Note.md',
                text: '> [!warning]+ Choice\n> Keep this\n\nText ^block\n\nFootnote[^1]\n\n[^1]: Decision\n\n<span>Visible</span> <a href="https://example.com">Website</a>\n<iframe src="https://example.com/video"></iframe>\n==highlight==',
            },
        ]);

        expect(plan.notes[0].markdown).toContain('**Warning:** Choice');
        expect(plan.notes[0].markdown).toContain('**Footnote 1:** Decision');
        expect(plan.notes[0].markdown).toContain('[Website](https://example.com)');
        expect(plan.notes[0].markdown).toContain('==highlight==');
        expect(plan.notes[0].markdown).not.toContain('^block');
    });

    it('extracts typed metadata and dates without importing export identities', () => {
        const plan = analyzeImport([
            {
                path: 'README.md',
                text: '---\ntitle: "A decision"\ncreated: 2025-01-02\nupdated_at: 2025-02-03T12:30:00Z\npriority: 4\ncomplete: false\nwebsite: https://example.com\npeople: [Ada, Lin]\nnote_id: "7"\npublish: true\nempty:\n---\n# A decision\n\nBody #topic #fff #123 `#code`',
            },
        ]);

        expect(plan.notes[0].title).toBe('A decision');
        expect(plan.notes[0].createdAt).toBe('2025-01-02T00:00:00.000Z');
        expect(plan.notes[0].properties).toEqual({
            priority: '4',
            complete: 'false',
            website: 'https://example.com',
            people: ['Ada', 'Lin'],
        });
        expect(plan.properties.find((property) => property.name === 'priority')?.valueType).toBe('number');
        expect(plan.tags).toEqual(['topic']);
        expect(plan.notes[0].markdown).toContain('#fff #123 `#code`');
        expect(plan.issues.map((issue) => issue.kind)).toContain('export-metadata');
    });

    it('allows preview overrides for properties, tags and single line breaks', () => {
        const input = [
            { path: 'A.md', text: '---\npublish: true\npeople: [Ada, Lin]\n---\nFirst\nSecond\n[[A]] #topic' },
        ];
        const plan = analyzeImport(input, {
            enabledToolProperties: ['publish'],
            listPropertiesAsTags: ['people'],
            disabledTags: ['topic'],
            lineBreaks: 'paragraph',
        });

        expect(plan.notes[0].properties).toEqual({ publish: 'true' });
        expect(plan.notes[0].markdown).toContain('First\nSecond');
        expect(plan.notes[0].markdown).toContain('#topic');
        expect(plan.notes[0].markdown).toContain('[@Ada] [@Lin]');
    });

    it('preserves single line breaks by default for Obsidian', () => {
        const plan = analyzeImport([{ path: 'A.md', text: 'First\nSecond\n\n[[A]]' }]);

        expect(plan.notes[0].markdown).toContain('First  \nSecond');
    });

    it('builds one folder tree and reports skipped settings and unreferenced files', () => {
        const plan = analyzeImport([
            { path: 'a/Note.md', text: 'Body' },
            { path: '.obsidian/config.json', text: '{}' },
            { path: 'unused.txt', text: 'Text' },
        ]);

        expect(createImportIndex(plan.notes, { 'a/Note.md': '10' })).toBe('- a\n  - [[Note]](note:10)');
        expect(plan.issues.filter((issue) => issue.kind === 'skipped-file')).toHaveLength(2);
    });

    it('rewrites Ocean Brain export IDs only to newly created notes', () => {
        const plan = analyzeImport([
            { path: 'a.md', text: '[[Old]](note:20)' },
            { path: 'b.md', text: '---\nnote_id: "20"\n---\nBody' },
        ]);

        expect(renderImportMarkdown(plan.notes[0], { 'b.md': '300' }, {})).toBe('[[Old]](note:300)');
    });
    it('keeps an already escaped pipe in a table image description inside its cell', () => {
        const plan = analyzeImport([
            { path: 'A.md', text: '| Item | Preview |\n| --- | --- |\n| First | ![a \\| b](photo.png) |' },
            { path: 'photo.png', bytes: png },
        ]);

        expect(plan.notes[0].markdown).toContain('| First | a \\| b |');
    });
    it('removes supported HTML tags that only form after an inner tag is removed', () => {
        const plan = analyzeImport([{ path: 'A.md', text: 'Before <di<b>v>Middle</div> after' }]);

        expect(plan.notes[0].markdown).not.toMatch(/(?:<|&lt;)\/?(?:b|div)>/);
        expect(plan.notes[0].markdown).toContain('Middle');
        expect(plan.issues).toEqual([]);
    });
    it('reads a frontmatter list with many backslashes without runaway backtracking', () => {
        const started = performance.now();
        const plan = analyzeImport([{ path: 'A.md', text: `---\naliases: ["${'\\!'.repeat(28)}]\n---\nBody` }]);

        expect(performance.now() - started).toBeLessThan(1000);
        expect(plan.notes[0].markdown).toBe('Body');
    });
});
