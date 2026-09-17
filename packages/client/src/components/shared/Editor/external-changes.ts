import { diffArrays } from 'diff';

interface ComparedBlock {
    id: string;
    fingerprint: string;
}

export interface BlockChange {
    id: string;
    kind: 'added' | 'modified';
}

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

export function compareEditorBlocks(previous: string, next: string) {
    const before = readBlocks(previous);
    const after = readBlocks(next);
    const changes: BlockChange[] = [];
    const parts = diffArrays(before, after, {
        comparator: (a, b) => a.id === b.id || a.fingerprint === b.fingerprint,
    });
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
