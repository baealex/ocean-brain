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

it('uses UTF-8 byte sizes when splitting batches', () => {
    const items = [{ text: '가'.repeat(20) }, { text: '나'.repeat(20) }];

    const batches = splitImportBatches(items, 25, 100);

    expect(batches).toHaveLength(2);
    expect(batches.flat()).toEqual(items);
});
