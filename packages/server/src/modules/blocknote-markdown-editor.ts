import { BlockNoteEditor } from '@blocknote/core';
import { JSDOM } from 'jsdom';

const restoreGlobalProperty = (key: 'window' | 'document', descriptor: PropertyDescriptor | undefined) => {
    if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
        return;
    }

    Reflect.deleteProperty(globalThis, key);
};

export class BlockNoteMarkdownEditor {
    private readonly editor = BlockNoteEditor.create();
    private readonly dom = new JSDOM();
    private queue: Promise<void> = Promise.resolve();

    static create() {
        return new BlockNoteMarkdownEditor();
    }

    private runWithDom<T>(operation: () => T | Promise<T>): Promise<T> {
        const run = this.queue.then(async () => {
            const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
            const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

            Object.defineProperty(globalThis, 'window', {
                configurable: true,
                writable: true,
                value: this.dom.window,
            });
            Object.defineProperty(globalThis, 'document', {
                configurable: true,
                writable: true,
                value: this.dom.window.document,
            });

            try {
                return await operation();
            } finally {
                restoreGlobalProperty('window', previousWindow);
                restoreGlobalProperty('document', previousDocument);
            }
        });

        this.queue = run.then(
            () => undefined,
            () => undefined,
        );

        return run;
    }

    blocksToMarkdownLossy(blocks: Parameters<(typeof this.editor)['blocksToMarkdownLossy']>[0]): Promise<string> {
        return this.runWithDom(() => this.editor.blocksToMarkdownLossy(blocks));
    }

    tryParseMarkdownToBlocks(markdown: string) {
        return this.runWithDom(() => this.editor.tryParseMarkdownToBlocks(markdown));
    }
}
