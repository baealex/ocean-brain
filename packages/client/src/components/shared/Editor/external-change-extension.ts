import { createExtension } from '@blocknote/core';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { getReviewText, type NoteReviewEntry } from '~/modules/note-content-changes';

const key = new PluginKey<NoteReviewEntry[]>('external-note-changes');

interface ReviewActions {
    onRestore: () => void;
    onReviewed: () => void;
}

interface ReviewMarker {
    kind: NoteReviewEntry['kind'];
    entries: NoteReviewEntry[];
    entryIndexes: number[];
    targetId?: string;
    anchorId?: string;
}

const markerLabel: Record<NoteReviewEntry['kind'], string> = {
    modified: 'AI updated',
    added: 'AI added',
    deleted: 'AI removed',
};

const getMarkerLabel = (marker: ReviewMarker) => {
    if (marker.kind !== 'deleted') return markerLabel[marker.kind];
    return marker.anchorId ? 'AI removed above' : 'AI removed after';
};

const displayText = (value: unknown) => getReviewText(value) || '(empty block)';

const getReviewMarkers = (entries: NoteReviewEntry[]): ReviewMarker[] => {
    const markers: ReviewMarker[] = [];

    entries.forEach((entry, entryIndex) => {
        if (entry.kind === 'deleted') {
            const previousMarker = markers[markers.length - 1];
            if (previousMarker?.kind === 'deleted' && previousMarker.anchorId === entry.anchorId) {
                previousMarker.entries.push(entry);
                previousMarker.entryIndexes.push(entryIndex);
                return;
            }
        }

        markers.push({
            kind: entry.kind,
            entries: [entry],
            entryIndexes: [entryIndex],
            targetId: entry.after?.id,
            anchorId: entry.anchorId,
        });
    });

    return markers;
};

const createComparisonRow = (label: 'Before' | 'Now', text: string) => {
    const row = document.createElement('div');
    row.className = 'note-ai-update__comparison-row';

    const term = document.createElement('span');
    term.className = 'note-ai-update__comparison-label';
    term.textContent = label;

    const value = document.createElement('span');
    value.className = 'note-ai-update__comparison-text';
    value.dataset.reviewValue = label.toLowerCase();
    value.textContent = text;

    row.append(term, value);
    return row;
};

const createReviewMarker = (
    position: number,
    marker: ReviewMarker,
    markerIndex: number,
    getActions: () => ReviewActions | undefined,
) =>
    Decoration.widget(
        position,
        () => {
            const label = getMarkerLabel(marker);
            const container = document.createElement('div');
            container.className = 'note-ai-update';
            container.contentEditable = 'false';
            container.dataset.open = 'false';
            container.dataset.reviewWidget = 'true';
            container.dataset.reviewTarget = marker.kind;
            container.dataset.reviewKind = marker.kind;
            container.dataset.reviewIndexes = marker.entryIndexes.join(',');

            const summary = document.createElement('button');
            summary.type = 'button';
            summary.className = 'note-ai-update__summary';
            summary.setAttribute('aria-label', `${label}. View before and now.`);
            summary.setAttribute('aria-expanded', 'false');

            const glyph = document.createElement('span');
            glyph.className = 'note-ai-update__glyph';
            glyph.ariaHidden = 'true';
            glyph.textContent = '✦';

            const summaryText = document.createElement('span');
            summaryText.className = 'note-ai-update__summary-text';
            summaryText.textContent = label;
            summary.append(glyph, summaryText);

            const comparison = document.createElement('div');
            comparison.className = 'note-ai-update__comparison';
            comparison.setAttribute('role', 'group');
            comparison.setAttribute('aria-label', 'This change');

            const comparisonScope = document.createElement('div');
            comparisonScope.className = 'note-ai-update__comparison-scope';
            comparisonScope.textContent = 'This change';

            const beforeText =
                marker.kind === 'added' ? '—' : marker.entries.map((entry) => displayText(entry.before)).join('\n\n');
            const nowText =
                marker.kind === 'deleted'
                    ? 'Removed'
                    : marker.entries.map((entry) => displayText(entry.after)).join('\n\n');
            comparison.append(
                comparisonScope,
                createComparisonRow('Before', beforeText),
                createComparisonRow('Now', nowText),
            );

            const actions = document.createElement('div');
            actions.className = 'note-ai-update__actions';
            actions.setAttribute('role', 'group');
            actions.setAttribute('aria-label', 'All AI changes. Already applied to this note.');

            const actionScope = document.createElement('div');
            actionScope.className = 'note-ai-update__action-scope';

            const actionScopeTitle = document.createElement('span');
            actionScopeTitle.className = 'note-ai-update__action-scope-title';
            actionScopeTitle.textContent = 'All AI changes';

            const actionScopeStatus = document.createElement('span');
            actionScopeStatus.className = 'note-ai-update__action-scope-status';
            actionScopeStatus.textContent = 'Already applied to this note';

            actionScope.append(actionScopeTitle, actionScopeStatus);

            const actionButtons = document.createElement('div');
            actionButtons.className = 'note-ai-update__action-buttons';

            const restore = document.createElement('button');
            restore.type = 'button';
            restore.className = 'note-ai-update__action';
            restore.dataset.reviewAction = 'restore';
            restore.textContent = 'Restore all AI changes';
            restore.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                getActions()?.onRestore();
            });

            const reviewed = document.createElement('button');
            reviewed.type = 'button';
            reviewed.className = 'note-ai-update__action note-ai-update__action--primary';
            reviewed.dataset.reviewAction = 'reviewed';
            reviewed.textContent = 'Mark all reviewed';
            reviewed.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                getActions()?.onReviewed();
            });

            actionButtons.append(restore, reviewed);
            actions.append(actionScope, actionButtons);

            const panel = document.createElement('div');
            panel.className = 'note-ai-update__panel';
            panel.id = `note-ai-update-panel-${markerIndex}-${marker.targetId ?? marker.anchorId ?? 'end'}`;
            panel.hidden = true;
            panel.append(comparison, actions);
            summary.setAttribute('aria-controls', panel.id);
            summary.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const shouldOpen = container.dataset.open !== 'true';

                container.ownerDocument
                    .querySelectorAll<HTMLElement>('.note-ai-update[data-open="true"]')
                    .forEach((openContainer) => {
                        openContainer.dataset.open = 'false';
                        openContainer
                            .querySelector<HTMLElement>('.note-ai-update__summary')
                            ?.setAttribute('aria-expanded', 'false');
                        const openPanel = openContainer.querySelector<HTMLElement>('.note-ai-update__panel');
                        if (openPanel) openPanel.hidden = true;
                    });

                container.dataset.open = String(shouldOpen);
                summary.setAttribute('aria-expanded', String(shouldOpen));
                panel.hidden = !shouldOpen;
            });
            container.append(summary, panel);
            return container;
        },
        {
            side: -1,
            key: `note-ai-update-${markerIndex}-${marker.kind}-${marker.targetId ?? marker.anchorId ?? 'end'}`,
            stopEvent: () => true,
            ignoreSelection: true,
        },
    );

export const ExternalChangeExtension = createExtension(({ editor }) => {
    let reviewActions: ReviewActions | undefined;

    return {
        key: 'externalNoteChanges' as const,
        prosemirrorPlugins: [
            new Plugin({
                key,
                state: {
                    init: (): NoteReviewEntry[] => [],
                    apply: (transaction, previous) => {
                        const entries: NoteReviewEntry[] | undefined = transaction.getMeta(key);
                        return entries ?? previous;
                    },
                },
                props: {
                    decorations: (state) => {
                        const entries = key.getState(state);
                        if (!entries?.length) return DecorationSet.empty;

                        const decorations: Decoration[] = [];
                        const positions = new Map<string, { node: Node; position: number }>();
                        state.doc.descendants((node, position) => {
                            if (node.type.name === 'blockContainer') positions.set(node.attrs.id, { node, position });
                        });
                        const blocks = Array.from(positions.values());
                        const fallbackBlock = blocks[blocks.length - 1];
                        const markerPosition = (block: { node: Node; position: number }) =>
                            block.position + 1 + (block.node.firstChild?.nodeSize ?? 0);

                        getReviewMarkers(entries).forEach((marker, markerIndex) => {
                            if (marker.kind === 'deleted') {
                                const block =
                                    (marker.anchorId ? positions.get(marker.anchorId) : undefined) ?? fallbackBlock;
                                if (!block) return;
                                decorations.push(
                                    Decoration.node(block.position, block.position + block.node.nodeSize, {
                                        'data-external-removal': marker.anchorId ? 'above' : 'after',
                                    }),
                                    createReviewMarker(markerPosition(block), marker, markerIndex, () => reviewActions),
                                );
                                return;
                            }

                            const block = marker.targetId && positions.get(marker.targetId);
                            if (!block) return;
                            decorations.push(
                                Decoration.node(block.position, block.position + block.node.nodeSize, {
                                    'data-external-change': marker.kind,
                                }),
                                createReviewMarker(markerPosition(block), marker, markerIndex, () => reviewActions),
                            );
                        });

                        return DecorationSet.create(state.doc, decorations);
                    },
                },
            }),
        ],
        setReview: (entries: NoteReviewEntry[], actions?: ReviewActions) => {
            reviewActions = actions;
            editor.transact((transaction) => transaction.setMeta(key, entries));
        },
    };
});
