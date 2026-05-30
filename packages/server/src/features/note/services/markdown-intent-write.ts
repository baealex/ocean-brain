import models, { type NoteLayout } from '~/models.js';
import {
    blocksToMarkdown,
    countReferenceInlinesFromContentJson,
    extractTagIdsFromContentJson,
    hasUnsupportedMarkdownBlocks,
    markdownToBlocksJson,
} from '~/modules/blocknote.js';
import type {
    MarkdownAppendPlanResult,
    MarkdownChangeDryRun,
    MarkdownChangeFailure,
    MarkdownChangePlan,
    MarkdownPatchOperation,
    MarkdownPatchPlanResult,
    MarkdownPatchSelector,
    MarkdownReplacePlanResult,
} from './markdown-patch.js';
import {
    buildMarkdownAppendPlan,
    buildMarkdownPatchPlan,
    buildMarkdownReplacePlan,
    calculateMarkdownSha256,
} from './markdown-patch.js';
import { MCP_SNAPSHOT_META } from './snapshot.js';
import { type GuardedNoteWriteResult, updateNoteWithVersionGuardAndSnapshot } from './write.js';
import {
    isInvalidNoteVersionError,
    isMissingNoteVersionError,
    isNoteVersionConflictError,
    parseNoteVersion,
} from './write-conflict.js';

interface MarkdownIntentNoteRecord {
    id: number;
    title: string;
    content: string;
    layout: NoteLayout;
    updatedAt: Date;
}

interface MarkdownIntentWriteDeps {
    findNoteById: (id: number) => Promise<MarkdownIntentNoteRecord | null>;
    renderMarkdown: (contentJson: string) => Promise<string>;
    parseMarkdownToContentJson: (markdown: string) => Promise<string>;
    extractTagIds: (contentJson: string) => string[];
    countReferenceInlines?: (contentJson: string) => number;
    hasUnsupportedMarkdownBlocks?: (contentJson: string) => boolean;
    updateNote: (input: {
        id: number;
        data: {
            title?: string;
            content?: string;
            layout?: NoteLayout;
            tagIds?: number[];
        };
        expectedUpdatedAt: string;
        snapshotMeta?: string;
        force?: boolean;
    }) => Promise<GuardedNoteWriteResult | null>;
}

export interface MarkdownWritePolicy {
    allowNoop?: boolean;
    maxChangedChars?: number;
    maxChangedLines?: number;
    preserveReferences?: boolean | 'warn';
    preserveTags?: boolean | 'warn';
}

export interface PatchNoteMarkdownInput {
    id: number;
    expectedUpdatedAt?: string;
    baseMarkdownSha256?: string;
    intent: string;
    selector: MarkdownPatchSelector;
    operation: MarkdownPatchOperation;
    policy?: MarkdownWritePolicy;
    dryRun?: boolean;
}

export interface AppendNoteMarkdownInput {
    id: number;
    expectedUpdatedAt?: string;
    baseMarkdownSha256?: string;
    intent: string;
    insertion: string;
    placement?:
        | {
              type: 'end';
          }
        | {
              type: 'after_heading';
              heading: string;
              level?: number;
          };
    separator?: '\n\n' | '\n';
    policy?: MarkdownWritePolicy;
    dryRun?: boolean;
}

export interface ReplaceNoteMarkdownInput {
    id: number;
    expectedUpdatedAt?: string;
    baseMarkdownSha256?: string;
    intent: string;
    replacement: string;
    policy?: MarkdownWritePolicy;
    dryRun?: boolean;
}

export interface UpdateNoteMetadataInput {
    id: number;
    expectedUpdatedAt: string;
    title?: string;
    layout?: NoteLayout;
}

export interface AppliedMarkdownWriteResult {
    status: 'applied';
    note: {
        id: string;
        updatedAt: string;
    };
    change: {
        summary: string;
        changedLineCount: number;
        changedCharCount: number;
    };
    snapshot: {
        id: string;
        label: string;
        createdAt: string;
    };
}

export interface MetadataUpdatePreview {
    status: 'dry_run';
    note: {
        id: string;
        title: string;
        updatedAt: string;
    };
    proposed: {
        title?: string;
        layout?: NoteLayout;
    };
    warnings: string[];
}

export interface AppliedMetadataUpdateResult {
    status: 'applied';
    note: {
        id: string;
        title: string;
        layout: NoteLayout;
        updatedAt: string;
    };
    snapshot: {
        id: string;
        label: string;
        createdAt: string;
    };
}

export type MarkdownIntentWriteResult =
    | MarkdownChangeDryRun
    | AppliedMarkdownWriteResult
    | MarkdownChangeFailure
    | Extract<MarkdownPatchPlanResult, { status: 'needs_disambiguation' }>;

export type MetadataUpdateResult = MetadataUpdatePreview | AppliedMetadataUpdateResult | MarkdownChangeFailure;

const serializeNoteSnapshot = async (
    note: MarkdownIntentNoteRecord,
    renderMarkdown: (contentJson: string) => Promise<string>,
) => {
    return {
        id: String(note.id),
        title: note.title,
        updatedAt: note.updatedAt.toISOString(),
        markdown: await renderMarkdown(note.content),
    };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const serializeSnapshot = (snapshot: unknown) => {
    const meta = isRecord(snapshot) && isRecord(snapshot.meta) ? snapshot.meta : {};
    const label = typeof meta.label === 'string' ? meta.label : 'MCP';

    return {
        id: isRecord(snapshot) && snapshot.id !== undefined ? String(snapshot.id) : '',
        label,
        createdAt: isRecord(snapshot) && typeof snapshot.createdAt === 'string' ? snapshot.createdAt : '',
    };
};

const toDryRun = (plan: MarkdownChangePlan): MarkdownChangeDryRun => ({
    status: 'dry_run',
    note: plan.note,
    ...(plan.match ? { match: plan.match } : {}),
    ...(plan.placement ? { placement: plan.placement } : {}),
    proposed: plan.proposed,
    warnings: plan.warnings,
});

const toTagIds = (tagIds: string[]) => {
    return tagIds.map((tagId) => Number(tagId)).filter((tagId) => Number.isSafeInteger(tagId) && tagId > 0);
};

const baselineMismatchFailure = (): MarkdownChangeFailure => ({
    status: 'failed',
    reason: 'BASELINE_MISMATCH',
    message: 'The markdown write baseline does not match the current note.',
});

const missingBaselineFailure = (): MarkdownChangeFailure => ({
    status: 'failed',
    reason: 'MISSING_BASELINE',
    message: 'expectedUpdatedAt or baseMarkdownSha256 is required for markdown writes.',
});

const unsupportedMarkdownStructureFailure = (): MarkdownChangeFailure => ({
    status: 'failed',
    reason: 'UNSUPPORTED_MARKDOWN_STRUCTURE',
    message: 'This note contains BlockNote content that cannot be safely represented as Markdown.',
});

const referenceStructureFailure = (): MarkdownChangeFailure => ({
    status: 'failed',
    reason: 'REFERENCE_STRUCTURE_DECREASED',
    message: 'The markdown write would reduce structured note reference links.',
});

const mapGuardedWriteError = (error: unknown): MarkdownChangeFailure | null => {
    if (isNoteVersionConflictError(error) || isInvalidNoteVersionError(error)) {
        return baselineMismatchFailure();
    }

    if (isMissingNoteVersionError(error)) {
        return missingBaselineFailure();
    }

    return null;
};

const noteVersionMatches = (expectedUpdatedAt: string | undefined, currentUpdatedAt: Date) => {
    try {
        const expectedTimestamp = parseNoteVersion(expectedUpdatedAt);

        return expectedTimestamp !== null && expectedTimestamp === currentUpdatedAt.getTime();
    } catch {
        return false;
    }
};

const getUnsupportedSourceFailure = (deps: MarkdownIntentWriteDeps, note: MarkdownIntentNoteRecord) => {
    if (deps.hasUnsupportedMarkdownBlocks?.(note.content)) {
        return unsupportedMarkdownStructureFailure();
    }

    return null;
};

const applyMarkdownPlan = async (
    deps: MarkdownIntentWriteDeps,
    input: {
        noteId: number;
        noteUpdatedAt: string;
        beforeContentJson: string;
        plan: Extract<MarkdownPatchPlanResult, { status: 'dry_run' }>;
        expectedUpdatedAt?: string;
        policy?: MarkdownWritePolicy;
        summary: string;
        force?: boolean;
    },
): Promise<AppliedMarkdownWriteResult | MarkdownChangeFailure> => {
    const content = await deps.parseMarkdownToContentJson(input.plan.afterMarkdown);
    const beforeReferenceCount = deps.countReferenceInlines?.(input.beforeContentJson) ?? 0;
    const afterReferenceCount = deps.countReferenceInlines?.(content) ?? 0;

    if (input.policy?.preserveReferences !== false && afterReferenceCount < beforeReferenceCount) {
        return referenceStructureFailure();
    }

    const tagIds = toTagIds(deps.extractTagIds(content));
    let updateResult: GuardedNoteWriteResult | null;

    try {
        updateResult = await deps.updateNote({
            id: input.noteId,
            data: {
                content,
                tagIds,
            },
            expectedUpdatedAt: input.expectedUpdatedAt ?? input.noteUpdatedAt,
            snapshotMeta: MCP_SNAPSHOT_META,
            ...(input.force ? { force: true } : {}),
        });
    } catch (error) {
        const mappedError = mapGuardedWriteError(error);

        if (mappedError) {
            return mappedError;
        }

        throw error;
    }

    if (!updateResult) {
        return {
            status: 'failed',
            reason: 'TARGET_NOT_FOUND',
            message: 'The requested note was not found.',
        };
    }

    return {
        status: 'applied',
        note: {
            id: String(updateResult.note.id),
            updatedAt: updateResult.note.updatedAt.toISOString(),
        },
        change: {
            summary: input.summary,
            changedLineCount: input.plan.proposed.changedLineCount,
            changedCharCount: input.plan.proposed.changedCharCount,
        },
        snapshot: serializeSnapshot(updateResult.snapshot),
    };
};

const mapPlanResult = async (
    deps: MarkdownIntentWriteDeps,
    input: {
        noteId: number;
        noteUpdatedAt: string;
        beforeContentJson: string;
        plan: MarkdownPatchPlanResult | MarkdownAppendPlanResult | MarkdownReplacePlanResult;
        dryRun?: boolean;
        expectedUpdatedAt?: string;
        policy?: MarkdownWritePolicy;
        summary: string;
        force?: boolean;
    },
): Promise<MarkdownIntentWriteResult> => {
    if (input.plan.status !== 'dry_run') {
        return input.plan;
    }

    if (input.dryRun ?? true) {
        return toDryRun(input.plan);
    }

    return applyMarkdownPlan(deps, {
        noteId: input.noteId,
        noteUpdatedAt: input.noteUpdatedAt,
        beforeContentJson: input.beforeContentJson,
        plan: input.plan,
        expectedUpdatedAt: input.expectedUpdatedAt,
        policy: input.policy,
        summary: input.summary,
        ...(input.force ? { force: true } : {}),
    });
};

export const createMarkdownIntentWriteService = (deps: MarkdownIntentWriteDeps) => ({
    patchNoteMarkdown: async (input: PatchNoteMarkdownInput): Promise<MarkdownIntentWriteResult> => {
        const note = await deps.findNoteById(input.id);

        if (!note) {
            return {
                status: 'failed',
                reason: 'TARGET_NOT_FOUND',
                message: 'The requested note was not found.',
            };
        }

        const unsupportedFailure = getUnsupportedSourceFailure(deps, note);

        if (unsupportedFailure) {
            return unsupportedFailure;
        }

        const noteSnapshot = await serializeNoteSnapshot(note, deps.renderMarkdown);
        const plan = buildMarkdownPatchPlan({
            note: noteSnapshot,
            expectedUpdatedAt: input.expectedUpdatedAt,
            baseMarkdownSha256: input.baseMarkdownSha256,
            intent: input.intent,
            selector: input.selector,
            operation: input.operation,
            policy: input.policy,
        });

        return mapPlanResult(deps, {
            noteId: input.id,
            noteUpdatedAt: noteSnapshot.updatedAt,
            beforeContentJson: note.content,
            plan,
            dryRun: input.dryRun,
            expectedUpdatedAt: input.expectedUpdatedAt,
            policy: input.policy,
            summary: input.intent,
        });
    },

    appendNoteMarkdown: async (input: AppendNoteMarkdownInput): Promise<MarkdownIntentWriteResult> => {
        const note = await deps.findNoteById(input.id);

        if (!note) {
            return {
                status: 'failed',
                reason: 'TARGET_NOT_FOUND',
                message: 'The requested note was not found.',
            };
        }

        const unsupportedFailure = getUnsupportedSourceFailure(deps, note);

        if (unsupportedFailure) {
            return unsupportedFailure;
        }

        const noteSnapshot = await serializeNoteSnapshot(note, deps.renderMarkdown);
        const plan = buildMarkdownAppendPlan({
            note: noteSnapshot,
            expectedUpdatedAt: input.expectedUpdatedAt,
            baseMarkdownSha256: input.baseMarkdownSha256,
            intent: input.intent,
            insertion: input.insertion,
            placement: input.placement,
            separator: input.separator,
            policy: input.policy,
        });

        return mapPlanResult(deps, {
            noteId: input.id,
            noteUpdatedAt: noteSnapshot.updatedAt,
            beforeContentJson: note.content,
            plan,
            dryRun: input.dryRun,
            expectedUpdatedAt: input.expectedUpdatedAt,
            policy: input.policy,
            summary: input.intent,
        });
    },

    replaceNoteMarkdown: async (input: ReplaceNoteMarkdownInput): Promise<MarkdownIntentWriteResult> => {
        const note = await deps.findNoteById(input.id);

        if (!note) {
            return {
                status: 'failed',
                reason: 'TARGET_NOT_FOUND',
                message: 'The requested note was not found.',
            };
        }

        const unsupportedFailure = getUnsupportedSourceFailure(deps, note);

        if (unsupportedFailure) {
            return unsupportedFailure;
        }

        const noteSnapshot = await serializeNoteSnapshot(note, deps.renderMarkdown);
        const plan = buildMarkdownReplacePlan({
            note: noteSnapshot,
            expectedUpdatedAt: input.expectedUpdatedAt,
            baseMarkdownSha256: input.baseMarkdownSha256,
            intent: input.intent,
            replacement: input.replacement,
            policy: input.policy,
        });

        return mapPlanResult(deps, {
            noteId: input.id,
            noteUpdatedAt: noteSnapshot.updatedAt,
            beforeContentJson: note.content,
            plan,
            dryRun: input.dryRun,
            expectedUpdatedAt: input.expectedUpdatedAt,
            policy: input.policy,
            summary: input.intent,
        });
    },

    updateNoteMetadata: async (input: UpdateNoteMetadataInput): Promise<MetadataUpdateResult> => {
        const note = await deps.findNoteById(input.id);

        if (!note) {
            return {
                status: 'failed',
                reason: 'TARGET_NOT_FOUND',
                message: 'The requested note was not found.',
            };
        }

        if (!noteVersionMatches(input.expectedUpdatedAt, note.updatedAt)) {
            return {
                status: 'failed',
                reason: input.expectedUpdatedAt ? 'BASELINE_MISMATCH' : 'MISSING_BASELINE',
                message: 'The metadata update baseline does not match the current note.',
            };
        }

        const nextTitle = input.title?.trim();

        if (input.title !== undefined && !nextTitle) {
            return {
                status: 'failed',
                reason: 'EMPTY_REPLACEMENT',
                message: 'Note title must not be empty.',
            };
        }

        if (nextTitle === note.title && (input.layout === undefined || input.layout === note.layout)) {
            return {
                status: 'failed',
                reason: 'NOOP',
                message: 'The metadata update would not change the note.',
            };
        }

        return {
            status: 'dry_run',
            note: {
                id: String(note.id),
                title: note.title,
                updatedAt: note.updatedAt.toISOString(),
            },
            proposed: {
                ...(nextTitle !== undefined ? { title: nextTitle } : {}),
                ...(input.layout !== undefined ? { layout: input.layout } : {}),
            },
            warnings: [],
        };
    },

    applyNoteMetadata: async (input: UpdateNoteMetadataInput): Promise<MetadataUpdateResult> => {
        const preview = await createMarkdownIntentWriteService(deps).updateNoteMetadata(input);

        if (preview.status !== 'dry_run') {
            return preview;
        }

        let updateResult: GuardedNoteWriteResult | null;

        try {
            updateResult = await deps.updateNote({
                id: input.id,
                data: {
                    ...(preview.proposed.title !== undefined ? { title: preview.proposed.title } : {}),
                    ...(preview.proposed.layout !== undefined ? { layout: preview.proposed.layout } : {}),
                },
                expectedUpdatedAt: input.expectedUpdatedAt,
                snapshotMeta: MCP_SNAPSHOT_META,
            });
        } catch (error) {
            const mappedError = mapGuardedWriteError(error);

            if (mappedError) {
                return mappedError;
            }

            throw error;
        }

        if (!updateResult) {
            return {
                status: 'failed',
                reason: 'TARGET_NOT_FOUND',
                message: 'The requested note was not found.',
            };
        }

        return {
            status: 'applied',
            note: {
                id: String(updateResult.note.id),
                title: updateResult.note.title,
                layout: updateResult.note.layout,
                updatedAt: updateResult.note.updatedAt.toISOString(),
            },
            snapshot: serializeSnapshot(updateResult.snapshot),
        };
    },
});

export const defaultMarkdownIntentWriteService = createMarkdownIntentWriteService({
    findNoteById: (id) =>
        models.note.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                content: true,
                layout: true,
                updatedAt: true,
            },
        }),
    renderMarkdown: blocksToMarkdown,
    parseMarkdownToContentJson: markdownToBlocksJson,
    extractTagIds: extractTagIdsFromContentJson,
    countReferenceInlines: countReferenceInlinesFromContentJson,
    hasUnsupportedMarkdownBlocks,
    updateNote: updateNoteWithVersionGuardAndSnapshot,
});

export const patchNoteMarkdown = async (input: PatchNoteMarkdownInput) => {
    return defaultMarkdownIntentWriteService.patchNoteMarkdown(input);
};

export const appendNoteMarkdown = async (input: AppendNoteMarkdownInput) => {
    return defaultMarkdownIntentWriteService.appendNoteMarkdown(input);
};

export const replaceNoteMarkdown = async (input: ReplaceNoteMarkdownInput) => {
    return defaultMarkdownIntentWriteService.replaceNoteMarkdown(input);
};

export const updateNoteMetadata = async (input: UpdateNoteMetadataInput & { dryRun?: boolean }) => {
    if (input.dryRun ?? true) {
        return defaultMarkdownIntentWriteService.updateNoteMetadata(input);
    }

    return defaultMarkdownIntentWriteService.applyNoteMetadata(input);
};

export const calculateNoteMarkdownSha256 = (markdown: string) => {
    return calculateMarkdownSha256(markdown);
};
