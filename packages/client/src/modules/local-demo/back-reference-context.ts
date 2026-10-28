import type { BackReferenceDetail } from '~/apis/note.api';

type Segment = BackReferenceDetail['contexts'][number]['segments'][number];
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// Local demo notes live in browser storage rather than the server reference index.
export const localBackReferenceContexts = (content: string, targetId: string) => {
    const contexts: BackReferenceDetail['contexts'] = [];
    const text = (value: unknown, segments: Segment[]) => {
        if (typeof value === 'string') {
            segments.push({ text: value, isTarget: false });
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((value) => text(value, segments));
            return;
        }
        if (!record(value)) return;
        if (value.type === 'reference' && record(value.props)) {
            segments.push({
                text: String(value.props.title ?? value.props.id ?? ''),
                isTarget: String(value.props.id) === targetId,
            });
            return;
        }
        if (typeof value.text === 'string') segments.push({ text: value.text, isTarget: false });
        for (const key of ['content', 'rows', 'cells']) if (key in value) text(value[key], segments);
    };
    const visit = (blocks: unknown[]) => {
        for (const block of blocks) {
            if (!record(block)) continue;
            const segments: Segment[] = [];
            text(block.content, segments);
            if (segments.some((segment) => segment.isTarget)) {
                let mention = 0;
                for (const segment of segments) {
                    if (segment.isTarget) break;
                    mention += segment.text.length;
                }
                const length = segments.reduce((sum, segment) => sum + segment.text.length, 0);
                const start = Math.max(0, mention - 32);
                const end = Math.min(length, start + 180);
                let offset = 0;
                const preview: Segment[] = start ? [{ text: '…', isTarget: false }] : [];
                for (const segment of segments) {
                    const value = segment.text
                        .slice(Math.max(0, start - offset), Math.max(0, end - offset))
                        .replace(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/g, '');
                    if (value) preview.push({ ...segment, text: value });
                    offset += segment.text.length;
                    if (offset >= end) break;
                }
                if (end < length) preview.push({ text: '…', isTarget: false });
                contexts.push({ blockId: typeof block.id === 'string' ? block.id : null, segments: preview });
                if (contexts.length > 3) return;
            }
            if (Array.isArray(block.children)) visit(block.children);
            if (contexts.length > 3) return;
        }
    };
    try {
        const blocks: unknown = JSON.parse(content);
        if (Array.isArray(blocks)) visit(blocks);
    } catch {
        /* Legacy plain-text notes have no structured references. */
    }
    return { contexts: contexts.slice(0, 3), hasMoreContexts: contexts.length > 3 };
};
