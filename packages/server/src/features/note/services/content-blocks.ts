import { parseBlockNoteContent, walkBlockNoteTree } from '~/modules/blocknote-tree.js';

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

interface NoteGraphInput {
    id: string | number;
    title: string;
    content: string;
}

export interface NoteGraphResult {
    nodes: Array<{ id: string; title: string; connections: number }>;
    links: Array<{ source: string; target: string }>;
}

export const NOTE_REFERENCE_CONTENT_PREFILTER = '"type":"reference"';

export const parseNoteContent = (content: string): unknown[] | null => {
    return parseBlockNoteContent(content);
};

export const extractBlocksByType = <T>(type: string, dataArray: unknown): BlockNote<T>[] => {
    const result: BlockNote<T>[] = [];

    walkBlockNoteTree(dataArray, (node) => {
        if (node.type === type) {
            result.push(node as BlockNote<T>);
        }
    });

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

export const buildNoteGraph = (notes: NoteGraphInput[]): NoteGraphResult => {
    const existingNoteIds = new Set(notes.map((note) => String(note.id)));
    const links: NoteGraphResult['links'] = [];
    const connectionCount: Record<string, number> = {};
    const linkSet = new Set<string>();

    for (const note of notes) {
        const sourceId = String(note.id);

        for (const block of extractReferenceBlocksFromContent(note.content)) {
            const targetId = block.props?.id ? String(block.props.id) : '';

            if (!targetId || sourceId === targetId || !existingNoteIds.has(targetId)) {
                continue;
            }

            const linkKey = `${sourceId}-${targetId}`;
            const reverseLinkKey = `${targetId}-${sourceId}`;

            if (linkSet.has(linkKey) || linkSet.has(reverseLinkKey)) {
                continue;
            }

            linkSet.add(linkKey);
            links.push({
                source: sourceId,
                target: targetId,
            });
            connectionCount[sourceId] = (connectionCount[sourceId] || 0) + 1;
            connectionCount[targetId] = (connectionCount[targetId] || 0) + 1;
        }
    }

    return {
        nodes: notes.map((note) => {
            const id = String(note.id);

            return {
                id,
                title: note.title || 'Untitled',
                connections: connectionCount[id] || 0,
            };
        }),
        links,
    };
};
