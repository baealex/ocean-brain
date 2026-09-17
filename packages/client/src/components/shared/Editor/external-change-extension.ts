import { createExtension } from '@blocknote/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { compareEditorBlocks } from './external-changes';

const key = new PluginKey<DecorationSet>('external-note-changes');

export const ExternalChangeExtension = createExtension(({ editor }) => ({
    key: 'externalNoteChanges',
    prosemirrorPlugins: [
        new Plugin<DecorationSet>({
            key,
            state: {
                init: () => DecorationSet.empty,
                apply: (transaction, decorations) => {
                    const replacement = transaction.getMeta(key);
                    if (replacement instanceof DecorationSet) return replacement;
                    return decorations.map(transaction.mapping, transaction.doc);
                },
            },
            props: { decorations: (state) => key.getState(state) },
        }),
    ],
    showChanges(previousContent: string, onClearChangeMarks?: () => void) {
        const { changes } = compareEditorBlocks(previousContent, JSON.stringify(editor.document));
        editor.transact((transaction) => {
            const decorations: Decoration[] = [];
            const changesById = new Map(changes.map((change) => [change.id, change.kind]));
            let reviewPosition: number | null = null;
            transaction.doc.descendants((node, position) => {
                if (typeof node.attrs.id !== 'string') return;
                const kind = changesById.get(node.attrs.id);
                if (kind) {
                    reviewPosition = Math.max(reviewPosition ?? 0, position + node.nodeSize);
                    decorations.push(
                        Decoration.node(position, position + node.nodeSize, {
                            'data-external-change': kind,
                            'aria-label': kind === 'added' ? 'Added by MCP' : 'Updated by MCP',
                        }),
                    );
                    node.descendants((child, offset) => {
                        // Nested blocks have their own change status; do not mark their text with the parent.
                        if (typeof child.attrs.id === 'string') return false;
                        if (!child.isTextblock) return;
                        if (child.content.size > 0) {
                            const from = position + offset + 2;
                            decorations.push(
                                Decoration.inline(from, from + child.content.size, { class: 'note-change-text' }),
                            );
                        }
                        return false;
                    });
                }
            });
            if (reviewPosition !== null && onClearChangeMarks) {
                decorations.push(
                    Decoration.widget(
                        reviewPosition,
                        () => {
                            const review = document.createElement('div');
                            review.className = 'note-change-review';
                            review.contentEditable = 'false';
                            const status = document.createElement('span');
                            status.className = 'note-change-status';
                            const label = document.createElement('span');
                            label.className = 'note-change-status__label';
                            label.textContent = 'AI changes';
                            status.append(label);
                            const done = document.createElement('button');
                            done.type = 'button';
                            done.className = 'note-change-review__done focus-ring-soft';
                            done.textContent = 'Done reviewing';
                            done.title = 'Hide AI change highlights';
                            done.addEventListener('click', onClearChangeMarks);
                            review.append(status, done);
                            return review;
                        },
                        { side: 1, ignoreSelection: true, stopEvent: () => true },
                    ),
                );
            }
            transaction.setMeta(key, DecorationSet.create(transaction.doc, decorations));
        });
    },
    clearChanges() {
        editor.transact((transaction) => transaction.setMeta(key, DecorationSet.empty));
    },
}));
