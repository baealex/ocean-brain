import models from '~/models.js';
import { isBlockNoteTreeNode, parseBlockNoteContent, walkBlockNoteTree } from '~/modules/blocknote-tree.js';

const MAX_VIEW_ID = 2_147_483_647;

export const getNoteLinkedViews = async (content: string) => {
    const references = new Map<string, string>();
    walkBlockNoteTree(parseBlockNoteContent(content), (block) => {
        if (block.type !== 'linkedView' || !isBlockNoteTreeNode(block.props)) return;
        const { viewId, viewTitle } = block.props;
        if (typeof viewId !== 'string' || !viewId.trim() || viewId.length > 256 || references.has(viewId)) return;
        references.set(viewId, typeof viewTitle === 'string' ? viewTitle : 'Linked view');
    });
    if (!references.size) return [];
    const ids = [...references.keys()].filter((id) => /^[1-9]\d*$/.test(id) && Number(id) <= MAX_VIEW_ID).map(Number);
    const views = await models.view.findMany({ where: { id: { in: ids } }, include: { group: true } });
    const byId = new Map(views.map((view) => [String(view.id), view]));
    return [...references].map(([viewId, title]) => {
        const view = byId.get(viewId);
        return {
            viewId,
            title: view?.title ?? title,
            groupId: view ? String(view.groupId) : null,
            groupTitle: view?.group.title ?? null,
            displayType: view?.displayType ?? null,
            status: view ? 'available' : 'missing',
        };
    });
};
