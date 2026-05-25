export type BlockNoteTreeNode = Record<string, unknown>;

export const isBlockNoteTreeNode = (value: unknown): value is BlockNoteTreeNode => {
    return typeof value === 'object' && value !== null;
};

export const parseBlockNoteContent = (content: string): unknown[] | null => {
    try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const walkBlockNoteTree = (value: unknown, visit: (node: BlockNoteTreeNode) => void) => {
    if (Array.isArray(value)) {
        for (const item of value) {
            walkBlockNoteTree(item, visit);
        }
        return;
    }

    if (!isBlockNoteTreeNode(value)) {
        return;
    }

    visit(value);

    if ('content' in value) {
        walkBlockNoteTree(value.content, visit);
    }

    if ('children' in value) {
        walkBlockNoteTree(value.children, visit);
    }

    if ('rows' in value) {
        walkBlockNoteTree(value.rows, visit);
    }

    if ('cells' in value) {
        walkBlockNoteTree(value.cells, visit);
    }
};
