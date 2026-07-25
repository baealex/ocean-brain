import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { describe, expect, it, vi } from 'vitest';

import { getRichCodeSlashMenuItems } from './CommandView';

vi.mock('@blocknote/core/extensions', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@blocknote/core/extensions')>();

    return {
        ...actual,
        insertOrUpdateBlockForSlashMenu: vi.fn(),
    };
});

describe('getRichCodeSlashMenuItems', () => {
    it('offers direct Mermaid and math block commands', () => {
        const editor = {} as Parameters<typeof getRichCodeSlashMenuItems>[0];
        const items = getRichCodeSlashMenuItems(editor);

        expect(items.map((item) => item.title)).toEqual(['Diagram', 'Math Formula']);
        expect(items[0].aliases).toEqual(expect.arrayContaining(['mermaid', 'flowchart']));
        expect(items[1].aliases).toEqual(expect.arrayContaining(['math', 'katex', 'latex']));

        items[0].onItemClick();
        items[1].onItemClick();

        expect(insertOrUpdateBlockForSlashMenu).toHaveBeenNthCalledWith(1, editor, {
            type: 'codeBlock',
            props: { language: 'mermaid' },
        });
        expect(insertOrUpdateBlockForSlashMenu).toHaveBeenNthCalledWith(2, editor, {
            type: 'codeBlock',
            props: { language: 'math' },
        });
    });
});
