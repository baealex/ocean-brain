import { diffArrays } from 'diff';

interface ComparedBlock {
    id: string;
    fingerprint: string;
}

export interface BlockChange {
    id: string;
    kind: 'added' | 'modified';
}

// Small edits align directly; large rewrites first exclude blocks that cannot match the other document.
const MAX_DIRECT_EDIT_DISTANCE = 128;

const blocksMatch = (a: ComparedBlock, b: ComparedBlock) => a.id === b.id || a.fingerprint === b.fingerprint;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const stableValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!isRecord(value)) return value;
    return Object.fromEntries(
        Object.keys(value)
            .sort()
            .map((key) => [key, stableValue(value[key])]),
    );
};

const readBlocks = (content: string): ComparedBlock[] => {
    const blocks: ComparedBlock[] = [];
    const visit = (items: unknown) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
            if (!isRecord(item) || typeof item.id !== 'string') continue;
            blocks.push({
                id: item.id,
                fingerprint: JSON.stringify(stableValue({ type: item.type, props: item.props, content: item.content })),
            });
            visit(item.children);
        }
    };
    try {
        visit(JSON.parse(content));
    } catch {
        /* An unavailable baseline must not prevent loading the latest note. */
    }
    return blocks;
};

const findMatchableBlocks = (blocks: ComparedBlock[], other: ComparedBlock[]) => {
    const ids = new Set(other.map((block) => block.id));
    const fingerprints = new Set(other.map((block) => block.fingerprint));
    return blocks
        .map((block, index) => ({ ...block, index }))
        .filter((block) => ids.has(block.id) || fingerprints.has(block.fingerprint));
};

const compareWithIndexedCandidates = (before: ComparedBlock[], after: ComparedBlock[]): BlockChange[] => {
    const oldCandidates = findMatchableBlocks(before, after);
    const newCandidates = findMatchableBlocks(after, before);
    // Keep exact sequence alignment for repeated/copied text rather than greedily consuming a later match.
    const parts = diffArrays(oldCandidates, newCandidates, { comparator: blocksMatch });

    const changes: BlockChange[] = [];
    let oldStart = 0;
    let newStart = 0;
    const markUnmatched = (oldEnd: number, newEnd: number) => {
        const replacedCount = Math.min(oldEnd - oldStart, newEnd - newStart);
        for (let index = newStart; index < newEnd; index++) {
            changes.push({ id: after[index].id, kind: index - newStart < replacedCount ? 'modified' : 'added' });
        }
    };

    let oldCandidateIndex = 0;
    let newCandidateIndex = 0;
    for (const part of parts) {
        if (part.removed) {
            oldCandidateIndex += part.value.length;
        } else if (part.added) {
            newCandidateIndex += part.value.length;
        } else {
            for (let offset = 0; offset < part.value.length; offset++) {
                const previous = oldCandidates[oldCandidateIndex + offset];
                const current = newCandidates[newCandidateIndex + offset];
                markUnmatched(previous.index, current.index);
                if (previous.fingerprint !== current.fingerprint) changes.push({ id: current.id, kind: 'modified' });
                oldStart = previous.index + 1;
                newStart = current.index + 1;
            }
            oldCandidateIndex += part.value.length;
            newCandidateIndex += part.value.length;
        }
    }
    markUnmatched(before.length, after.length);
    return changes;
};

export function compareEditorBlocks(previous: string, next: string) {
    const before = readBlocks(previous);
    const after = readBlocks(next);
    const changes: BlockChange[] = [];
    const parts = diffArrays(before, after, {
        comparator: blocksMatch,
        maxEditLength: MAX_DIRECT_EDIT_DISTANCE,
    });
    if (!parts) return { changes: compareWithIndexedCandidates(before, after) };
    let oldIndex = 0;
    let newIndex = 0;
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        if (part.removed) {
            const added = parts[index + 1]?.added ? parts[index + 1].value : [];
            const paired = Math.min(part.value.length, added.length);
            for (let offset = 0; offset < paired; offset++) {
                changes.push({ id: added[offset].id, kind: 'modified' });
            }
            for (const block of added.slice(paired)) changes.push({ id: block.id, kind: 'added' });
            oldIndex += part.value.length;
            if (added.length) {
                newIndex += added.length;
                index++;
            }
        } else if (part.added) {
            for (const block of part.value) changes.push({ id: block.id, kind: 'added' });
            newIndex += part.value.length;
        } else {
            for (let offset = 0; offset < part.value.length; offset++) {
                if (before[oldIndex + offset].fingerprint !== after[newIndex + offset].fingerprint) {
                    changes.push({ id: after[newIndex + offset].id, kind: 'modified' });
                }
            }
            oldIndex += part.value.length;
            newIndex += part.value.length;
        }
    }
    return { changes };
}

export interface EditorViewport {
    scroll: Array<{ element: HTMLElement; top: number; left: number }>;
}

export function captureEditorViewport(element?: HTMLElement): EditorViewport {
    const scroll: EditorViewport['scroll'] = [];
    let parent = element?.parentElement;
    while (parent) {
        if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
            scroll.push({ element: parent, top: parent.scrollTop, left: parent.scrollLeft });
        }
        parent = parent.parentElement;
    }
    return { scroll };
}

export function restoreEditorViewport(viewport?: EditorViewport) {
    for (const { element, top, left } of viewport?.scroll ?? []) {
        if (element.isConnected) {
            element.scrollTop = top;
            element.scrollLeft = left;
        }
    }
}
