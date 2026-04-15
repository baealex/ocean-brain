import type { Note, Prisma } from '@prisma/client';
import { buildNoteTagNamesWhere, type NoteTagMatchMode } from '~/features/note/services/tag-filter.js';
import models from '~/models.js';

export type ViewTagMatchMode = NoteTagMatchMode;

export interface ViewSectionRecord {
    id: string;
    tabId: string;
    title: string;
    tagNames: string[];
    mode: ViewTagMatchMode;
    limit: number;
    order: number;
}

export interface ViewTabRecord {
    id: string;
    title: string;
    order: number;
    sections: ViewSectionRecord[];
}

export interface ViewWorkspaceRecord {
    activeTabId: string | null;
    tabs: ViewTabRecord[];
}

export interface ViewSectionInput {
    title?: string;
    tagNames: string[];
    mode?: ViewTagMatchMode;
    limit?: number;
}

export interface ViewSectionNotesResult {
    totalCount: number;
    notes: Note[];
}

const VIEW_WORKSPACE_ID = 1;

export const DEFAULT_VIEW_SECTION_LIMIT = 5;
export const MIN_VIEW_SECTION_LIMIT = 1;
export const MAX_VIEW_SECTION_LIMIT = 20;

type ViewDbClient = typeof models | Prisma.TransactionClient;

const orderedViewSectionTagsInclude = {
    tags: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    },
} satisfies Prisma.ViewSectionInclude;

const orderedViewTabSectionsInclude = {
    sections: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: orderedViewSectionTagsInclude,
    },
} satisfies Prisma.ViewTabInclude;

type DbViewSection = Prisma.ViewSectionGetPayload<{
    include: typeof orderedViewSectionTagsInclude;
}>;

type DbViewTab = Prisma.ViewTabGetPayload<{
    include: typeof orderedViewTabSectionsInclude;
}>;

const normalizeTagName = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return '';
    }

    if (trimmedValue.startsWith('@')) {
        return trimmedValue;
    }

    if (trimmedValue.startsWith('#')) {
        return `@${trimmedValue.slice(1)}`;
    }

    return `@${trimmedValue}`;
};

export const normalizeViewTagNames = (values: string[]) => {
    const normalizedTagNames = values.flatMap((value) => value.split(','));

    return Array.from(new Set(normalizedTagNames.map(normalizeTagName).filter(Boolean)));
};

export const clampViewSectionLimit = (value: number | undefined) => {
    const numericValue = typeof value === 'number' ? value : Number.NaN;

    if (!Number.isInteger(numericValue)) {
        return DEFAULT_VIEW_SECTION_LIMIT;
    }

    return Math.min(MAX_VIEW_SECTION_LIMIT, Math.max(MIN_VIEW_SECTION_LIMIT, numericValue));
};

export const normalizeViewTabTitle = (title: string) => {
    const trimmedTitle = title.trim();

    return trimmedTitle || 'Untitled View';
};

const buildDefaultSectionTitle = (tagNames: string[]) => {
    if (tagNames.length === 0) {
        return 'Tagged notes';
    }

    return tagNames.slice(0, 2).join(' + ');
};

export const normalizeViewSectionInput = (input: ViewSectionInput) => {
    const tagNames = normalizeViewTagNames(input.tagNames);

    if (tagNames.length === 0) {
        throw new Error('A view section requires at least one tag.');
    }

    const trimmedTitle = input.title?.trim() ?? '';

    return {
        title: trimmedTitle || buildDefaultSectionTitle(tagNames),
        tagNames,
        mode: input.mode === 'or' ? 'or' : 'and',
        limit: clampViewSectionLimit(input.limit),
    } satisfies {
        title: string;
        tagNames: string[];
        mode: ViewTagMatchMode;
        limit: number;
    };
};

export const pickNextActiveViewTabId = (tabIds: number[], deletedTabId: number, currentActiveTabId: number | null) => {
    const remainingTabIds = tabIds.filter((tabId) => tabId !== deletedTabId);

    if (remainingTabIds.length === 0) {
        return null;
    }

    if (currentActiveTabId !== deletedTabId) {
        return currentActiveTabId;
    }

    return remainingTabIds[0] ?? null;
};

const ensureValidReorderIds = (currentIds: number[], nextIds: number[]) => {
    if (currentIds.length !== nextIds.length) {
        throw new Error('Reorder payload must include every item exactly once.');
    }

    const currentIdSet = new Set(currentIds);
    const nextIdSet = new Set(nextIds);

    if (currentIdSet.size !== currentIds.length || nextIdSet.size !== nextIds.length) {
        throw new Error('Reorder payload contains duplicate ids.');
    }

    for (const id of currentIdSet) {
        if (!nextIdSet.has(id)) {
            throw new Error('Reorder payload must match the current item set.');
        }
    }
};

const parseViewId = (id: string) => {
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
        throw new Error('A valid id is required.');
    }

    return numericId;
};

const serializeViewSection = (section: DbViewSection): ViewSectionRecord => ({
    id: String(section.id),
    tabId: String(section.tabId),
    title: section.title,
    tagNames: section.tags.map((tag) => tag.name),
    mode: section.mode as ViewTagMatchMode,
    limit: section.limit,
    order: section.order,
});

const serializeViewTab = (tab: DbViewTab): ViewTabRecord => ({
    id: String(tab.id),
    title: tab.title,
    order: tab.order,
    sections: tab.sections.map(serializeViewSection),
});

const getOrderedViewTabs = async (db: ViewDbClient) => {
    return db.viewTab.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: orderedViewTabSectionsInclude,
    });
};

const ensureViewWorkspace = async (db: ViewDbClient) => {
    return db.viewWorkspace.upsert({
        where: { id: VIEW_WORKSPACE_ID },
        update: {},
        create: { id: VIEW_WORKSPACE_ID },
    });
};

const readViewWorkspace = async (db: ViewDbClient): Promise<ViewWorkspaceRecord> => {
    const [workspace, tabs] = await Promise.all([ensureViewWorkspace(db), getOrderedViewTabs(db)]);

    const activeTabId =
        workspace.activeTabId !== null && tabs.some((tab) => tab.id === workspace.activeTabId)
            ? String(workspace.activeTabId)
            : tabs[0]
              ? String(tabs[0].id)
              : null;

    return {
        activeTabId,
        tabs: tabs.map(serializeViewTab),
    };
};

const readViewSection = async (db: ViewDbClient, id: number): Promise<ViewSectionRecord | null> => {
    const section = await db.viewSection.findUnique({
        where: { id },
        include: orderedViewSectionTagsInclude,
    });

    return section ? serializeViewSection(section) : null;
};

const getNextTabOrder = async (db: ViewDbClient) => {
    const lastTab = await db.viewTab.findFirst({
        orderBy: [{ order: 'desc' }, { createdAt: 'desc' }],
        select: { order: true },
    });

    return lastTab ? lastTab.order + 1 : 0;
};

const getNextSectionOrder = async (db: ViewDbClient, tabId: number) => {
    const lastSection = await db.viewSection.findFirst({
        where: { tabId },
        orderBy: [{ order: 'desc' }, { createdAt: 'desc' }],
        select: { order: true },
    });

    return lastSection ? lastSection.order + 1 : 0;
};

const resequenceViewTabs = async (db: ViewDbClient) => {
    const tabs = await db.viewTab.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
    });

    await Promise.all(
        tabs.map((tab, index) =>
            db.viewTab.update({
                where: { id: tab.id },
                data: { order: index },
            }),
        ),
    );
};

const resequenceViewSections = async (db: ViewDbClient, tabId: number) => {
    const sections = await db.viewSection.findMany({
        where: { tabId },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
    });

    await Promise.all(
        sections.map((section, index) =>
            db.viewSection.update({
                where: { id: section.id },
                data: { order: index },
            }),
        ),
    );
};

export const getViewWorkspace = async () => {
    return readViewWorkspace(models);
};

export const getViewSectionById = async (id: string) => {
    return readViewSection(models, parseViewId(id));
};

export const getViewSectionNotes = async (
    id: string,
    pagination: {
        limit: number;
        offset: number;
    },
): Promise<ViewSectionNotesResult | null> => {
    const section = await models.viewSection.findUnique({
        where: { id: parseViewId(id) },
        include: orderedViewSectionTagsInclude,
    });

    if (!section) {
        return null;
    }

    const tagNames = section.tags.map((tag) => tag.name);

    if (tagNames.length === 0) {
        return {
            totalCount: 0,
            notes: [],
        };
    }

    const where = buildNoteTagNamesWhere(tagNames, section.mode as NoteTagMatchMode);

    const [totalCount, notes] = await Promise.all([
        models.note.count({ where }),
        models.note.findMany({
            orderBy: { updatedAt: 'desc' },
            where,
            take: Number(pagination.limit),
            skip: Number(pagination.offset),
        }),
    ]);

    return {
        totalCount,
        notes,
    };
};

export const createViewTab = async (title: string) => {
    return models.$transaction(async (tx) => {
        const workspace = await ensureViewWorkspace(tx);
        const nextTabOrder = await getNextTabOrder(tx);
        const createdTab = await tx.viewTab.create({
            data: {
                title: normalizeViewTabTitle(title),
                order: nextTabOrder,
            },
            include: orderedViewTabSectionsInclude,
        });

        if (workspace.activeTabId === null) {
            await tx.viewWorkspace.update({
                where: { id: VIEW_WORKSPACE_ID },
                data: { activeTabId: createdTab.id },
            });
        }

        return serializeViewTab(createdTab);
    });
};

export const updateViewTab = async (id: string, title: string) => {
    const updatedTab = await models.viewTab.update({
        where: { id: parseViewId(id) },
        data: {
            title: normalizeViewTabTitle(title),
        },
        include: orderedViewTabSectionsInclude,
    });

    return serializeViewTab(updatedTab);
};

export const deleteViewTab = async (id: string) => {
    const tabId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const workspace = await ensureViewWorkspace(tx);
        const tabs = await tx.viewTab.findMany({
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });

        if (!tabs.some((tab) => tab.id === tabId)) {
            return false;
        }

        await tx.viewTab.delete({ where: { id: tabId } });
        await resequenceViewTabs(tx);

        const nextActiveTabId = pickNextActiveViewTabId(
            tabs.map((tab) => tab.id),
            tabId,
            workspace.activeTabId,
        );

        await tx.viewWorkspace.update({
            where: { id: VIEW_WORKSPACE_ID },
            data: { activeTabId: nextActiveTabId },
        });

        return true;
    });
};

export const setActiveViewTab = async (id: string) => {
    const tabId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const workspace = await ensureViewWorkspace(tx);
        const tab = await tx.viewTab.findUnique({
            where: { id: tabId },
            select: { id: true },
        });

        if (!tab) {
            throw new Error('View tab not found.');
        }

        await tx.viewWorkspace.update({
            where: { id: workspace.id },
            data: { activeTabId: tabId },
        });

        return readViewWorkspace(tx);
    });
};

export const reorderViewTabs = async (tabIds: string[]) => {
    const nextTabIds = tabIds.map(parseViewId);

    return models.$transaction(async (tx) => {
        const tabs = await tx.viewTab.findMany({
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });
        const currentTabIds = tabs.map((tab) => tab.id);

        ensureValidReorderIds(currentTabIds, nextTabIds);

        await Promise.all(
            nextTabIds.map((tabId, index) =>
                tx.viewTab.update({
                    where: { id: tabId },
                    data: { order: index },
                }),
            ),
        );

        const reorderedTabs = await getOrderedViewTabs(tx);
        return reorderedTabs.map(serializeViewTab);
    });
};

export const createViewSection = async (tabId: string, input: ViewSectionInput) => {
    const numericTabId = parseViewId(tabId);
    const nextSection = normalizeViewSectionInput(input);

    return models.$transaction(async (tx) => {
        const tab = await tx.viewTab.findUnique({
            where: { id: numericTabId },
            select: { id: true },
        });

        if (!tab) {
            throw new Error('View tab not found.');
        }

        const nextSectionOrder = await getNextSectionOrder(tx, numericTabId);

        const createdSection = await tx.viewSection.create({
            data: {
                tabId: numericTabId,
                title: nextSection.title,
                mode: nextSection.mode,
                limit: nextSection.limit,
                order: nextSectionOrder,
                tags: {
                    create: nextSection.tagNames.map((tagName, index) => ({
                        name: tagName,
                        order: index,
                    })),
                },
            },
            include: orderedViewSectionTagsInclude,
        });

        return serializeViewSection(createdSection);
    });
};

export const updateViewSection = async (id: string, input: ViewSectionInput) => {
    const sectionId = parseViewId(id);
    const nextSection = normalizeViewSectionInput(input);

    const updatedSection = await models.viewSection.update({
        where: { id: sectionId },
        data: {
            title: nextSection.title,
            mode: nextSection.mode,
            limit: nextSection.limit,
            tags: {
                deleteMany: {},
                create: nextSection.tagNames.map((tagName, index) => ({
                    name: tagName,
                    order: index,
                })),
            },
        },
        include: orderedViewSectionTagsInclude,
    });

    return serializeViewSection(updatedSection);
};

export const deleteViewSection = async (id: string) => {
    const sectionId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const section = await tx.viewSection.findUnique({
            where: { id: sectionId },
            select: { id: true, tabId: true },
        });

        if (!section) {
            return false;
        }

        await tx.viewSection.delete({
            where: { id: sectionId },
        });
        await resequenceViewSections(tx, section.tabId);

        return true;
    });
};

export const reorderViewSections = async (tabId: string, sectionIds: string[]) => {
    const numericTabId = parseViewId(tabId);
    const nextSectionIds = sectionIds.map(parseViewId);

    return models.$transaction(async (tx) => {
        const sections = await tx.viewSection.findMany({
            where: { tabId: numericTabId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });
        const currentSectionIds = sections.map((section) => section.id);

        ensureValidReorderIds(currentSectionIds, nextSectionIds);

        await Promise.all(
            nextSectionIds.map((sectionId, index) =>
                tx.viewSection.update({
                    where: { id: sectionId },
                    data: { order: index },
                }),
            ),
        );

        const reorderedSections = await tx.viewSection.findMany({
            where: { tabId: numericTabId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: orderedViewSectionTagsInclude,
        });

        return reorderedSections.map(serializeViewSection);
    });
};
