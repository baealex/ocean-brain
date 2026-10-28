import { createExtension } from '@blocknote/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const key = new PluginKey<DecorationSet>('note-reference-target');

export const ReferenceTargetExtension = createExtension(({ editor }) => ({
    key: 'noteReferenceTarget',
    prosemirrorPlugins: [
        new Plugin<DecorationSet>({
            key,
            state: {
                init: () => DecorationSet.empty,
                apply: (transaction, decorations) => {
                    const replacement = transaction.getMeta(key);
                    return replacement instanceof DecorationSet
                        ? replacement
                        : decorations.map(transaction.mapping, transaction.doc);
                },
            },
            props: { decorations: (state) => key.getState(state) },
        }),
    ],
    highlight(blockId: string) {
        editor.transact((transaction) => {
            const decorations: Decoration[] = [];
            transaction.doc.descendants((node, position) => {
                if (node.attrs.id === blockId) {
                    decorations.push(
                        Decoration.node(position, position + node.nodeSize, { 'data-backlink-target': 'true' }),
                    );
                    return false;
                }
            });
            transaction.setMeta(key, DecorationSet.create(transaction.doc, decorations));
        });
    },
    clear() {
        editor.transact((transaction) => transaction.setMeta(key, DecorationSet.empty));
    },
}));
