import crypto from 'crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
    confirmedMcpWriteFields,
    type createMcpWriteSafetyCoordinator,
    type PublicPendingWriteOperation
} from './mcp-write-safety.js';

interface IntentWriteToolNames {
    appendNoteMarkdown: string;
    patchNoteMarkdown: string;
    replaceNoteMarkdown: string;
    updateNoteMetadata: string;
}

type JsonRequest = <TResponse extends Record<string, unknown>>(
    serverUrl: string,
    token: string | undefined,
    pathName: string,
    body: Record<string, unknown>
) => Promise<TResponse>;

type McpWriteSafetyCoordinator = ReturnType<typeof createMcpWriteSafetyCoordinator>;

interface RegisterIntentWriteToolsInput {
    jsonRequest: JsonRequest;
    requireWriteToken: (token: string | undefined, toolName: string) => string;
    serverUrl: string;
    token?: string;
    tools: IntentWriteToolNames;
    writeSafety: McpWriteSafetyCoordinator;
}

interface ConfirmedWriteRequest {
    dryRun?: boolean;
    operationId?: string;
    confirmToken?: string;
}

interface DryRunWriteResult extends Record<string, unknown> {
    status?: string;
    reason?: string;
    proposed?: {
        changedLineCount?: number;
    };
}

const markdownPatchSelectorSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('exact_text'),
        text: z.string(),
        before: z.string().optional(),
        after: z.string().optional()
    }),
    z.object({
        type: z.literal('match_candidate'),
        text: z.string(),
        matchIndex: z.number().int().nonnegative(),
        lineStart: z.number().int().positive(),
        matchSha256: z.string(),
        surroundingHash: z.string(),
        positionHint: z.enum(['first', 'last']).optional()
    })
]);

const markdownPatchOperationSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('replace'),
        replacement: z.string()
    }),
    z.object({
        type: z.literal('insert_before'),
        insertion: z.string()
    }),
    z.object({
        type: z.literal('insert_after'),
        insertion: z.string()
    })
]);

const markdownAppendPlacementSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('end')
    }),
    z.object({
        type: z.literal('after_heading'),
        heading: z.string(),
        level: z.number().int().min(1).max(6).optional()
    })
]);

const markdownWritePolicySchema = z.object({
    allowNoop: z.boolean().optional(),
    maxChangedChars: z.number().int().nonnegative().optional(),
    maxChangedLines: z.number().int().nonnegative().optional(),
    preserveTags: z.union([z.boolean(), z.literal('warn')]).optional(),
    preserveReferences: z.union([z.boolean(), z.literal('warn')]).optional()
}).optional();

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const normalizeServerUrl = (serverUrl: string) => {
    try {
        const url = new URL(serverUrl);
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch {
        return serverUrl.replace(/\/$/, '');
    }
};

export const createIntentWriteOperationFingerprint = (
    serverUrl: string,
    token: string | undefined,
    toolName: string,
    payload: Record<string, unknown>
) => {
    return sha256(JSON.stringify({
        payload,
        serverUrl: normalizeServerUrl(serverUrl),
        tokenDigest: token ? sha256(token) : null,
        toolName
    }));
};

const getErrorDetail = (error: unknown) => {
    return error instanceof Error ? error.message : 'Unknown MCP write error';
};

const prepareConfirmedWriteOperation = (
    writeSafety: McpWriteSafetyCoordinator,
    result: DryRunWriteResult,
    input: {
        affectedIds: string[];
        operationFingerprint: string;
        summary: string;
        toolName: string;
    }
) => {
    if (result.status !== 'dry_run') {
        return result;
    }

    return {
        ...result,
        operation: writeSafety.prepareOperation({
            actor: 'mcp-bearer',
            affectedIds: input.affectedIds,
            estimatedChangeCount: result.proposed?.changedLineCount ?? 1,
            operationFingerprint: input.operationFingerprint,
            risk: 'high-impact',
            summary: input.summary,
            toolName: input.toolName
        })
    };
};

const requireConfirmedWriteOperation = (
    writeSafety: McpWriteSafetyCoordinator,
    request: ConfirmedWriteRequest,
    input: {
        affectedIds: string[];
        operationFingerprint: string;
        summary: string;
        toolName: string;
    }
) => {
    const intent = writeSafety.ensureDestructiveWriteRequest(
        request,
        {
            actor: 'mcp-bearer',
            affectedIds: input.affectedIds,
            estimatedChangeCount: 1,
            operationFingerprint: input.operationFingerprint,
            risk: 'high-impact',
            summary: input.summary,
            toolName: input.toolName
        }
    );

    if (intent.kind !== 'confirmed') {
        throw new Error('Expected a confirmed MCP write operation.');
    }

    return intent.operation;
};

const executeConfirmedWrite = async (
    writeSafety: McpWriteSafetyCoordinator,
    operation: PublicPendingWriteOperation,
    request: () => Promise<DryRunWriteResult>
) => {
    try {
        const result = await request();

        writeSafety.recordWriteResult(
            operation,
            result.status === 'applied',
            result.status === 'applied' ? undefined : result.reason
        );

        return result;
    } catch (error) {
        writeSafety.recordWriteResult(operation, false, getErrorDetail(error));
        throw error;
    }
};

export const registerIntentWriteTools = (
    server: McpServer,
    {
        jsonRequest,
        requireWriteToken,
        serverUrl,
        token,
        tools,
        writeSafety
    }: RegisterIntentWriteToolsInput
) => {
    server.tool(
        tools.patchNoteMarkdown,
        'Patch a small part of an Ocean Brain note. Dry-run is the default; commit requires operationId and confirmToken from the dry-run result.',
        {
            id: z.string().describe('Note ID to patch'),
            expectedUpdatedAt: z.string().optional().describe('Expected note updatedAt from a prior read. Required unless baseMarkdownSha256 is provided.'),
            baseMarkdownSha256: z.string().optional().describe('SHA-256 of the current markdown. Required unless expectedUpdatedAt is provided.'),
            intent: z.string().describe('Human-readable reason for the patch.'),
            selector: markdownPatchSelectorSchema.describe('Exact text or previously returned match candidate.'),
            operation: markdownPatchOperationSchema.describe('replace, insert_before, or insert_after.'),
            policy: markdownWritePolicySchema,
            ...confirmedMcpWriteFields
        },
        async ({ id, expectedUpdatedAt, baseMarkdownSha256, intent, selector, operation, policy, dryRun, operationId, confirmToken }) => {
            const writeToken = requireWriteToken(token, tools.patchNoteMarkdown);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(baseMarkdownSha256 ? { baseMarkdownSha256 } : {}),
                intent,
                selector,
                operation,
                ...(policy ? { policy } : {})
            };
            const operationFingerprint = createIntentWriteOperationFingerprint(serverUrl, writeToken, tools.patchNoteMarkdown, payload);

            if (dryRun) {
                const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/patch-markdown', {
                    ...payload,
                    dryRun: true
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(prepareConfirmedWriteOperation(writeSafety, result, {
                            affectedIds: [id],
                            operationFingerprint,
                            summary: intent,
                            toolName: tools.patchNoteMarkdown
                        }), null, 2)
                    }]
                };
            }

            const confirmedOperation = requireConfirmedWriteOperation(
                writeSafety,
                { dryRun, operationId, confirmToken },
                {
                    affectedIds: [id],
                    operationFingerprint,
                    summary: intent,
                    toolName: tools.patchNoteMarkdown
                }
            );
            const result = await executeConfirmedWrite(
                writeSafety,
                confirmedOperation,
                () => jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/patch-markdown', {
                    ...payload,
                    dryRun: false
                })
            );

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        tools.appendNoteMarkdown,
        'Append markdown to a note without replacing existing body content. Dry-run is the default; commit requires operationId and confirmToken.',
        {
            id: z.string().describe('Note ID to append to'),
            expectedUpdatedAt: z.string().optional().describe('Expected note updatedAt from a prior read. Required unless baseMarkdownSha256 is provided.'),
            baseMarkdownSha256: z.string().optional().describe('SHA-256 of the current markdown. Required unless expectedUpdatedAt is provided.'),
            intent: z.string().describe('Human-readable reason for the append.'),
            insertion: z.string().describe('Markdown to append. Tags are body tokens such as [@tag] or [#tag].'),
            placement: markdownAppendPlacementSchema.optional().describe('Default is end. after_heading requires one unique matching heading.'),
            separator: z.enum(['\n\n', '\n']).optional().describe('Separator inserted around appended markdown. Defaults to a blank line.'),
            policy: markdownWritePolicySchema,
            ...confirmedMcpWriteFields
        },
        async ({ id, expectedUpdatedAt, baseMarkdownSha256, intent, insertion, placement, separator, policy, dryRun, operationId, confirmToken }) => {
            const writeToken = requireWriteToken(token, tools.appendNoteMarkdown);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(baseMarkdownSha256 ? { baseMarkdownSha256 } : {}),
                intent,
                insertion,
                ...(placement ? { placement } : {}),
                ...(separator ? { separator } : {}),
                ...(policy ? { policy } : {})
            };
            const operationFingerprint = createIntentWriteOperationFingerprint(serverUrl, writeToken, tools.appendNoteMarkdown, payload);

            if (dryRun) {
                const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/append-markdown', {
                    ...payload,
                    dryRun: true
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(prepareConfirmedWriteOperation(writeSafety, result, {
                            affectedIds: [id],
                            operationFingerprint,
                            summary: intent,
                            toolName: tools.appendNoteMarkdown
                        }), null, 2)
                    }]
                };
            }

            const confirmedOperation = requireConfirmedWriteOperation(
                writeSafety,
                { dryRun, operationId, confirmToken },
                {
                    affectedIds: [id],
                    operationFingerprint,
                    summary: intent,
                    toolName: tools.appendNoteMarkdown
                }
            );
            const result = await executeConfirmedWrite(
                writeSafety,
                confirmedOperation,
                () => jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/append-markdown', {
                    ...payload,
                    dryRun: false
                })
            );

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        tools.updateNoteMetadata,
        'Update note metadata only. Supports title and layout; tags are markdown body tokens and are not handled here.',
        {
            id: z.string().describe('Note ID to update'),
            expectedUpdatedAt: z.string().describe('Expected note updatedAt from a prior read.'),
            title: z.string().optional().describe('New note title'),
            layout: z.enum(['narrow', 'wide', 'full']).optional().describe('New note layout'),
            ...confirmedMcpWriteFields
        },
        async ({ id, expectedUpdatedAt, title, layout, dryRun, operationId, confirmToken }) => {
            const writeToken = requireWriteToken(token, tools.updateNoteMetadata);
            const payload = {
                id,
                expectedUpdatedAt,
                ...(title !== undefined ? { title } : {}),
                ...(layout ? { layout } : {})
            };
            const summary = `Update note ${id} metadata`;
            const operationFingerprint = createIntentWriteOperationFingerprint(serverUrl, writeToken, tools.updateNoteMetadata, payload);

            if (dryRun) {
                const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/metadata', {
                    ...payload,
                    dryRun: true
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(prepareConfirmedWriteOperation(writeSafety, result, {
                            affectedIds: [id],
                            operationFingerprint,
                            summary,
                            toolName: tools.updateNoteMetadata
                        }), null, 2)
                    }]
                };
            }

            const confirmedOperation = requireConfirmedWriteOperation(
                writeSafety,
                { dryRun, operationId, confirmToken },
                {
                    affectedIds: [id],
                    operationFingerprint,
                    summary,
                    toolName: tools.updateNoteMetadata
                }
            );
            const result = await executeConfirmedWrite(
                writeSafety,
                confirmedOperation,
                () => jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/metadata', {
                    ...payload,
                    dryRun: false
                })
            );

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        tools.replaceNoteMarkdown,
        'Replace a note body as a high-impact full overwrite. Dry-run returns a full diff; commit requires operationId and confirmToken.',
        {
            id: z.string().describe('Note ID to replace'),
            expectedUpdatedAt: z.string().optional().describe('Expected note updatedAt from a prior read. Required unless baseMarkdownSha256 is provided.'),
            baseMarkdownSha256: z.string().optional().describe('SHA-256 of the current markdown. Required unless expectedUpdatedAt is provided.'),
            intent: z.string().describe('Human-readable reason for the full replace.'),
            replacement: z.string().describe('Complete replacement markdown body. Tags are body tokens such as [@tag] or [#tag].'),
            policy: markdownWritePolicySchema,
            ...confirmedMcpWriteFields
        },
        async ({ id, expectedUpdatedAt, baseMarkdownSha256, intent, replacement, policy, dryRun, operationId, confirmToken }) => {
            const writeToken = requireWriteToken(token, tools.replaceNoteMarkdown);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(baseMarkdownSha256 ? { baseMarkdownSha256 } : {}),
                intent,
                replacement,
                ...(policy ? { policy } : {})
            };
            const operationFingerprint = createIntentWriteOperationFingerprint(serverUrl, writeToken, tools.replaceNoteMarkdown, payload);

            if (dryRun) {
                const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/replace-markdown', {
                    ...payload,
                    dryRun: true
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(prepareConfirmedWriteOperation(writeSafety, result, {
                            affectedIds: [id],
                            operationFingerprint,
                            summary: intent,
                            toolName: tools.replaceNoteMarkdown
                        }), null, 2)
                    }]
                };
            }

            const confirmedOperation = requireConfirmedWriteOperation(
                writeSafety,
                { dryRun, operationId, confirmToken },
                {
                    affectedIds: [id],
                    operationFingerprint,
                    summary: intent,
                    toolName: tools.replaceNoteMarkdown
                }
            );
            const result = await executeConfirmedWrite(
                writeSafety,
                confirmedOperation,
                () => jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/replace-markdown', {
                    ...payload,
                    dryRun: false
                })
            );

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );
};
