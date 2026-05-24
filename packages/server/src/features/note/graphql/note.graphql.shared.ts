interface BlockNote<T = unknown> {
    id?: string;
    type?: string;
    props?: T;
    content?: unknown;
    children?: unknown;
}

interface ReferenceProps {
    id?: string | number;
    title?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

export const parseNoteContent = (content: string): unknown[] | null => {
    try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const extractBlocksByType = <T>(type: string, dataArray: unknown): BlockNote<T>[] => {
    const result: BlockNote<T>[] = [];

    const visit = (value: unknown) => {
        if (Array.isArray(value)) {
            for (const item of value) {
                visit(item);
            }
            return;
        }

        if (!isRecord(value)) {
            return;
        }

        if (value.type === type) {
            result.push(value as BlockNote<T>);
        }

        if (Array.isArray(value.content)) {
            visit(value.content);
        }

        if (Array.isArray(value.children)) {
            visit(value.children);
        }
    };

    visit(dataArray);

    return result;
};

export const extractReferenceBlocks = (dataArray: unknown) => {
    return extractBlocksByType<ReferenceProps>('reference', dataArray).filter((block) => {
        return block.props?.id !== undefined && block.props.id !== null && String(block.props.id).trim() !== '';
    });
};

export const extractReferenceBlocksFromContent = (content: string) => {
    const parsed = parseNoteContent(content);
    return parsed ? extractReferenceBlocks(parsed) : [];
};

export const contentReferencesNote = (content: string, noteId: string | number) => {
    const targetId = String(noteId);
    return extractReferenceBlocksFromContent(content).some((block) => String(block.props?.id) === targetId);
};

export const syncReferenceTitlesInContent = (content: string, titlesById: Map<string, string>) => {
    const parsed = parseNoteContent(content);

    if (!parsed) {
        return null;
    }

    let changed = false;

    for (const block of extractReferenceBlocks(parsed)) {
        const props = block.props;
        const id = props?.id;

        if (!props || id === undefined || id === null) {
            continue;
        }

        const title = titlesById.get(String(id));

        if (title !== undefined && props.title !== title) {
            block.props = {
                ...props,
                title,
            };
            changed = true;
        }
    }

    return changed ? JSON.stringify(parsed) : content;
};
