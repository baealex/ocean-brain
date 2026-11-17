import JSZip from 'jszip';
import { readImportFiles, splitImportBatches } from './files';
import { analyzeImport, createImportIndex } from './index';

it.each(['folder', 'zip'])('uses the common %s wrapper as the vault root', async (source) => {
    const entries = [
        ['Picked/Start.md', '[[Topics/Decision]]'],
        ['Picked/Topics/Decision.md', 'A decision'],
        ['Picked/Other/Decision.md', 'Another decision'],
    ];
    let selected: File[];
    if (source === 'zip') {
        const zip = new JSZip();
        for (const [path, text] of entries) zip.file(path, text);
        const bytes = await zip.generateAsync({ type: 'uint8array' });
        const file = new File([bytes], 'notes.zip');
        Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
        selected = [file];
    } else {
        selected = entries.map(([path, text]) => {
            const file = new File([text], path.split('/').at(-1)!);
            Object.defineProperty(file, 'webkitRelativePath', { value: path });
            Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode(text).buffer });
            return file;
        });
    }

    const files = await readImportFiles(selected);
    const plan = analyzeImport(files);

    expect(files[0].path).toBe('Start.md');
    expect(plan.links).toEqual([{ from: 'Start.md', to: 'Topics/Decision.md', label: 'Decision' }]);
    expect(createImportIndex(plan.notes, {})).not.toContain('Picked');
});

it('decodes mixed UTF-8 zip names with JSZip', async () => {
    const zip = new JSZip();
    zip.file('한글.md', '# 한글');
    zip.file('ascii.md', 'Body');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const file = new File([bytes], 'notes.zip');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });

    const files = await readImportFiles([file]);

    expect(files.map((file) => file.path)).toEqual(['한글.md', 'ascii.md']);
    expect(files[0].text).toBe('# 한글');
});

const zipFile = async (entries: Array<[string, string | Uint8Array]>, name = 'notes.zip') => {
    const zip = new JSZip();
    for (const [path, content] of entries) zip.file(path, content);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const file = new File([bytes], name);
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    return { file, bytes };
};

it('opens the export parts inside a zip that wraps only zip files, as Notion downloads do', async () => {
    const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const part1 = await zipFile([[`Home ${id}.md`, `# Home\n\n[Plan](Home%20${id}/Plan%20${id}.md)`]]);
    const part2 = await zipFile([[`Home ${id}/Plan ${id}.md`, '# Plan\n\nBody']]);
    const { file } = await zipFile(
        [
            ['Export-1234-Part-1.zip', part1.bytes],
            ['Export-1234-Part-2.zip', part2.bytes],
        ],
        'Export-1234.zip',
    );

    const plan = analyzeImport(await readImportFiles([file]));

    expect(plan.notes.map((note) => note.title)).toEqual(['Home', 'Plan']);
    expect(plan.links).toHaveLength(1);
});

it('keeps a zip stored next to notes as an attachment instead of opening it', async () => {
    const attachment = await zipFile([['Inside.md', 'Not part of the vault']]);
    const { file } = await zipFile([
        ['Start.md', 'Body'],
        ['attachments/archive.zip', attachment.bytes],
    ]);

    const files = await readImportFiles([file]);

    expect(files.map((item) => item.path)).toEqual(['Start.md', 'attachments/archive.zip']);
});

it('uses UTF-8 byte sizes when splitting batches', () => {
    const items = [{ text: '가'.repeat(20) }, { text: '나'.repeat(20) }];

    const batches = splitImportBatches(items, 25, 100);

    expect(batches).toHaveLength(2);
    expect(batches.flat()).toEqual(items);
});
