import assert from 'node:assert/strict';
import test from 'node:test';
import { blocksToMarkdown } from '~/modules/blocknote.js';
import { importMarkdownToBlocksJson } from './markdown.js';

test('quoted syntax inside an imported fence remains literal code', async () => {
    const content = await importMarkdownToBlocksJson('```md\n> [!info] Example\n> Body\n```', new Map());

    const output = await blocksToMarkdown(content);

    assert.match(output, /> \[!info\] Example\n> Body/);
});

test('callout labels, authored bold titles and body line breaks survive storage', async () => {
    const content = await importMarkdownToBlocksJson('> **Info:** **Chosen**  \n> Body  \n> Next', new Map());

    const output = await blocksToMarkdown(content);

    assert.match(output, /\*\*Chosen\*\*/);
    assert.match(output, /Chosen\*\*[^\n]*\n[^\n]*Body[^\n]*\n[^\n]*Next/);
});

test('import image hints set previewWidth without changing the image URL or name', async () => {
    const content = await importMarkdownToBlocksJson(
        '![photo.png](/assets/images/photo.png "ocean-import-width:100")',
        new Map(),
    );

    const image = JSON.parse(content).find((block: { type: string }) => block.type === 'image');

    assert.equal(image.props.previewWidth, 100);
    assert.equal(image.props.url, '/assets/images/photo.png');
    assert.equal(image.props.name, 'photo.png');
});

test('image sizes apply to the correct occurrence of a repeated image URL', async () => {
    const content = await importMarkdownToBlocksJson(
        '![first](/assets/images/photo.png)\n\n![second](/assets/images/photo.png "ocean-import-width:100")',
        new Map(),
    );

    const images = JSON.parse(content).filter((block: { type: string }) => block.type === 'image');

    assert.notEqual(images[0].props.previewWidth, 100);
    assert.equal(images[1].props.previewWidth, 100);
});

test('image-looking hints in multiline inline code remain literal', async () => {
    const markdown = '``literal\n![example](/assets/images/photo.png "ocean-import-width:100")\n``';

    const content = await importMarkdownToBlocksJson(markdown, new Map());

    assert.match(await blocksToMarkdown(content), /ocean-import-width:100/);
});

test('import references preserve different aliases for the same destination', async () => {
    const content = await importMarkdownToBlocksJson(
        '[[First]](note:10) and **[[Second]](note:10)**',
        new Map([['10', { id: '10', title: 'Canonical' }]]),
    );

    const output = await blocksToMarkdown(content);

    assert.match(output, /First \(\[\[Canonical\]\]\(note:10\)\)/);
    assert.match(output, /Second/);
    assert.equal((output.match(/\[\[Canonical\]\]\(note:10\)/g) ?? []).length, 2);
});

test('reference-looking code remains visible without creating backlinks', async () => {
    const content = await importMarkdownToBlocksJson(
        '`[[Example]](note:10)`\n\n```md\n[[Example]](note:10)\n```',
        new Map([['10', { id: '10', title: 'Canonical' }]]),
    );

    assert.doesNotMatch(content, /"type":"reference"/);
    assert.match(await blocksToMarkdown(content), /Example/);
});

test('multiline inline code never becomes an active imported reference', async () => {
    const content = await importMarkdownToBlocksJson(
        '``literal\n[[Example]](note:10)\n``',
        new Map([['10', { id: '10', title: 'Target' }]]),
    );

    assert.doesNotMatch(content, /"type":"reference"/);
    assert.doesNotMatch(content, /OBIMPORT/);
    assert.match(await blocksToMarkdown(content), /Example/);
});
