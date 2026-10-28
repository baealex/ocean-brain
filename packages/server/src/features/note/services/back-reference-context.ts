import { isBlockNoteTreeNode } from '~/modules/blocknote-tree.js';
import { normalizeReferenceId, parseNoteContent } from './content-blocks.js';

export interface ReferenceContextSegment {
    text: string;
    isTarget: boolean;
}

export interface BackReferenceContext {
    blockId: string | null;
    segments: ReferenceContextSegment[];
}

const MAX_CONTEXTS = 3;
const MAX_PREVIEW_LENGTH = 180;
const MAX_LEADING_CONTEXT = 32;

const appendSegment = (segments: ReferenceContextSegment[], text: string, isTarget = false) => {
    if (!text) return;
    const previous = segments.at(-1);
    if (previous && !previous.isTarget && !isTarget) previous.text += text;
    else segments.push({ text, isTarget });
};

const collectInlineText = (value: unknown, targetId: string, segments: ReferenceContextSegment[]) => {
    if (typeof value === 'string') {
        appendSegment(segments, value.replace(/\s+/g, ' '));
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectInlineText(item, targetId, segments);
        return;
    }
    if (!isBlockNoteTreeNode(value)) return;
    if (value.type === 'reference' && isBlockNoteTreeNode(value.props)) {
        const id = normalizeReferenceId(value.props.id);
        appendSegment(
            segments,
            typeof value.props.title === 'string' ? value.props.title : (id ?? ''),
            id === targetId,
        );
        return;
    }
    if (typeof value.text === 'string') appendSegment(segments, value.text.replace(/\s+/g, ' '));
    if (value.type === 'hardBreak') appendSegment(segments, ' ');
    if ('content' in value) collectInlineText(value.content, targetId, segments);
    for (const field of ['rows', 'cells']) {
        if (!Array.isArray(value[field])) continue;
        for (const item of value[field]) {
            collectInlineText(item, targetId, segments);
            appendSegment(segments, ' ');
        }
    }
};

const cropAroundMention = (segments: ReferenceContextSegment[]) => {
    const length = segments.reduce((sum, segment) => sum + segment.text.length, 0);
    let mentionOffset = 0;
    for (const segment of segments) {
        if (segment.isTarget) break;
        mentionOffset += segment.text.length;
    }
    const start = Math.max(0, mentionOffset - MAX_LEADING_CONTEXT);
    const end = Math.min(length, start + MAX_PREVIEW_LENGTH);
    const result: ReferenceContextSegment[] = [];
    if (start > 0) appendSegment(result, '…');
    let offset = 0;
    for (const segment of segments) {
        const from = Math.max(0, start - offset);
        const to = Math.min(segment.text.length, end - offset);
        if (to > from) {
            const text = segment.text.slice(from, to).replace(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/g, '');
            appendSegment(result, text, segment.isTarget);
        }
        offset += segment.text.length;
        if (offset >= end) break;
    }
    if (end < length) appendSegment(result, '…');
    return result;
};

export const extractBackReferenceContexts = (content: string, noteId: string) => {
    const contexts: BackReferenceContext[] = [];
    const blocks = parseNoteContent(content);
    const targetId = normalizeReferenceId(noteId);
    if (!blocks || !targetId) return { contexts, hasMore: false };

    const visit = (blocks: unknown[]) => {
        for (const block of blocks) {
            if (!isBlockNoteTreeNode(block)) continue;
            const segments: ReferenceContextSegment[] = [];
            collectInlineText(block.content, targetId, segments);
            if (segments.some((segment) => segment.isTarget)) {
                contexts.push({
                    blockId: typeof block.id === 'string' && block.id.length > 0 ? block.id : null,
                    segments: cropAroundMention(segments),
                });
                if (contexts.length > MAX_CONTEXTS) return;
            }
            if (Array.isArray(block.children)) visit(block.children);
            if (contexts.length > MAX_CONTEXTS) return;
        }
    };
    visit(blocks);
    return { contexts: contexts.slice(0, MAX_CONTEXTS), hasMore: contexts.length > MAX_CONTEXTS };
};
