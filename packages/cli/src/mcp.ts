import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
    createMcpWriteSafetyCoordinator,
    confirmedMcpWriteFields,
    defaultMcpWriteSafetyDir,
    destructiveMcpWriteFields,
    formatMcpGraphqlError
} from './mcp-write-safety.js';
import { formatMcpReadNoteOutput } from './mcp-note-output.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
);

export const OCEAN_BRAIN_MCP_TOOLS = {
    searchNotes: 'ocean_brain_search_notes',
    readNote: 'ocean_brain_read_note',
    createNote: 'ocean_brain_create_note',
    updateNote: 'ocean_brain_update_note',
    patchNoteMarkdown: 'ocean_brain_patch_note_markdown',
    appendNoteMarkdown: 'ocean_brain_append_note_markdown',
    updateNoteMetadata: 'ocean_brain_update_note_metadata',
    replaceNoteMarkdown: 'ocean_brain_replace_note_markdown',
    listTags: 'ocean_brain_list_tags',
    listNotesByTag: 'ocean_brain_list_notes_by_tag',
    listNotesByTags: 'ocean_brain_list_notes_by_tags',
    listRecentNotes: 'ocean_brain_list_recent_notes',
    writeSafetyStatus: 'ocean_brain_write_safety_status',
    findNoteCleanupCandidates: 'ocean_brain_find_note_cleanup_candidates',
    createTag: 'ocean_brain_create_tag',
    deleteNote: 'ocean_brain_delete_note'
} as const;

const noteLayoutSchema = z.enum(['narrow', 'wide', 'full']);
const tagMatchModeSchema = z.enum(['and', 'or']);
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

const normalizeOceanBrainTagName = (name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
        throw new Error('Tag name is required.');
    }

    const normalizedName = trimmedName.startsWith('@')
        ? trimmedName
        : `@${trimmedName}`;

    if (normalizedName === '@' || /\s/.test(normalizedName.slice(1))) {
        throw new Error('Ocean Brain tag names must be a single token. Example: @project');
    }

    return normalizedName;
};

const normalizeOceanBrainTagNames = (names: string[]) => {
    return Array.from(
        new Set(names.map(normalizeOceanBrainTagName))
    );
};

const fetchOceanBrainTags = async (
    serverUrl: string,
    token: string | undefined,
    query: string
) => {
    const data = await graphql(serverUrl, token, `
        query ($searchFilter: SearchFilterInput, $pagination: PaginationInput) {
            allTags(searchFilter: $searchFilter, pagination: $pagination) {
                totalCount
                tags {
                    id
                    name
                    referenceCount
                }
            }
        }
    `, {
        searchFilter: { query },
        pagination: { limit: 100, offset: 0 }
    });

    return data?.allTags as {
        totalCount: number;
        tags: Array<{ id: string; name: string; referenceCount: number }>;
    };
};

async function graphql(
    serverUrl: string,
    token: string | undefined,
    query: string,
    variables?: Record<string, unknown>
) {
    const response = await fetch(`${serverUrl}/graphql/mcp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as {
        data?: Record<string, unknown>;
        errors?: Array<{
            message: string;
            extensions?: {
                code?: string;
                operationId?: string;
            };
        }>;
    };

    if (result.errors?.length) {
        throw new Error(formatMcpGraphqlError(result.errors[0]));
    }

    return result.data;
}

async function jsonRequest<TResponse extends Record<string, unknown>>(
    serverUrl: string,
    token: string | undefined,
    pathName: string,
    body: Record<string, unknown>
) {
    const response = await fetch(`${serverUrl}${pathName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
    });

    const result = await response.json() as TResponse & {
        code?: string;
        message?: string;
    };

    if (!response.ok) {
        throw new Error(`Request failed: ${result.code || response.status} ${result.message || response.statusText}`);
    }

    return result;
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

const createOperationFingerprint = (toolName: string, payload: Record<string, unknown>) => {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify({ toolName, payload }))
        .digest('hex');
};

const requireWriteToken = (token: string | undefined, toolName: string) => {
    if (token) {
        return token;
    }

    throw new Error(`${toolName} requires an MCP bearer token. Set --token or --token-file.`);
};

export async function startMcpServer(
    serverUrl: string,
    token?: string,
    options: { writeSafetyDir?: string } = {}
) {
    const server = new McpServer({
        name: 'ocean-brain',
        version: pkg.version,
    });
    const writeSafety = createMcpWriteSafetyCoordinator({
        rootDir: options.writeSafetyDir ?? defaultMcpWriteSafetyDir()
    });
    const prepareConfirmedWriteOperation = (
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
        request: ConfirmedWriteRequest,
        input: {
            affectedIds: string[];
            operationFingerprint: string;
            summary: string;
            toolName: string;
        }
    ) => {
        return writeSafety.ensureDestructiveWriteRequest(
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
    };

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.searchNotes,
        'Search Ocean Brain notes by keyword. Returns matching note titles and tags. Use ocean_brain_read_note to get full content for a specific note.',
        {
            query: z.string().describe('Search keyword'),
            limit: z.number().optional().default(10).describe('Max results (default: 10)'),
        },
        async ({ query, limit }) => {
            const data = await graphql(serverUrl, token, `
                query ($searchFilter: SearchFilterInput, $pagination: PaginationInput) {
                    allNotes(searchFilter: $searchFilter, pagination: $pagination) {
                        totalCount
                        notes {
                            id
                            title
                            updatedAt
                            tags { id name }
                            contentAsMarkdown
                        }
                    }
                }
            `, {
                searchFilter: { query, sortBy: 'updatedAt', sortOrder: 'desc' },
                pagination: { limit, offset: 0 },
            });

            const result = data?.allNotes as {
                totalCount: number;
                notes: Array<{
                    id: string;
                    title: string;
                    updatedAt: string;
                    tags: Array<{ id: string; name: string }>;
                    contentAsMarkdown: string;
                }>;
            };

            const notes = result.notes.map((note) => ({
                id: note.id,
                title: note.title,
                updatedAt: note.updatedAt,
                tags: note.tags.map((t) => t.name),
                preview: note.contentAsMarkdown.slice(0, 100),
            }));

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({ totalCount: result.totalCount, notes }, null, 2),
                }],
            };
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.readNote,
        'Read an Ocean Brain note by ID. Returns truncated content by default (1000 chars) and includes a back-reference summary. Set maxLength to 0 only when full content is necessary.',
        {
            id: z.string().describe('Note ID'),
            maxLength: z.number().optional().default(1000).describe('Max content length in characters. 0 for full content. (default: 1000)'),
        },
        async ({ id, maxLength }) => {
            const data = await graphql(serverUrl, token, `
                query ($id: ID!) {
                    note(id: $id) {
                        id
                        title
                        contentAsMarkdown
                        createdAt
                        updatedAt
                        tags { id name }
                    }
                    backReferences(id: $id) {
                        id
                        title
                    }
                }
            `, { id });

            const note = data?.note as {
                id: string;
                title: string;
                contentAsMarkdown: string;
                createdAt: string;
                updatedAt: string;
                tags: Array<{ id: string; name: string }>;
            };
            const backReferences = (data?.backReferences as Array<{
                id: string;
                title: string;
            }> | undefined) ?? [];
            const output = formatMcpReadNoteOutput({
                note,
                backReferences,
                maxLength
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: output,
                }],
            };
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.createNote,
        'Create an Ocean Brain note from markdown. Search/read first to avoid duplicates; prefer patching an existing note when the intent is a local change.',
        {
            title: z.string().describe('Note title'),
            markdown: z.string().optional().default('').describe('Markdown body for the new note. In MCP markdown, tags must use [@tag] or [#tag]. Defaults to an empty note body.'),
            layout: noteLayoutSchema.optional().describe('Optional note layout: narrow, wide, or full. Prefer wide for most notes unless the user explicitly wants narrow or full.')
        },
        async ({ title, markdown, layout }) => {
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.createNote);
            const result = await jsonRequest<{
                created: boolean;
                note: {
                    id: string;
                    title: string;
                    layout: 'narrow' | 'wide' | 'full';
                    createdAt: string;
                    updatedAt: string;
                };
            }>(serverUrl, writeToken, '/api/mcp/notes/create', {
                title,
                markdown,
                ...(layout ? { layout } : {})
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.updateNote,
        'Legacy full-field note update through the MCP write path. Prefer patch/append/metadata tools for small changes; use this only when intentionally replacing provided fields.',
        {
            id: z.string().describe('Note ID to update'),
            title: z.string().optional().describe('New note title'),
            markdown: z.string().optional().describe('Replacement markdown body. In MCP markdown, tags must use [@tag] or [#tag].'),
            layout: noteLayoutSchema.optional().describe('Optional note layout: narrow, wide, or full. Prefer wide for most notes unless the user explicitly wants narrow or full.')
        },
        async ({ id, title, markdown, layout }) => {
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.updateNote);
            const result = await jsonRequest<{
                updated?: boolean;
                code?: string;
                note?: {
                    id: string;
                    title: string;
                    layout: 'narrow' | 'wide' | 'full';
                    createdAt: string;
                    updatedAt: string;
                };
            }>(serverUrl, writeToken, '/api/mcp/notes/update', {
                id,
                ...(title !== undefined ? { title } : {}),
                ...(markdown !== undefined ? { markdown } : {}),
                ...(layout ? { layout } : {})
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown,
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
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(baseMarkdownSha256 ? { baseMarkdownSha256 } : {}),
                intent,
                selector,
                operation,
                ...(policy ? { policy } : {})
            };
            const operationFingerprint = createOperationFingerprint(OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown, payload);

            if (dryRun) {
                const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/patch-markdown', {
                    ...payload,
                    dryRun: true
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(prepareConfirmedWriteOperation(result, {
                            affectedIds: [id],
                            operationFingerprint,
                            summary: intent,
                            toolName: OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown
                        }), null, 2)
                    }]
                };
            }

            const confirmed = requireConfirmedWriteOperation(
                { dryRun, operationId, confirmToken },
                {
                    affectedIds: [id],
                    operationFingerprint,
                    summary: intent,
                    toolName: OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown
                }
            );
            const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/patch-markdown', {
                ...payload,
                dryRun: false
            });

            writeSafety.recordWriteResult(
                confirmed.operation,
                result.status === 'applied',
                result.status === 'applied' ? undefined : result.reason
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
        OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown,
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
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown);
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
            const operationFingerprint = createOperationFingerprint(OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown, payload);

            if (dryRun) {
                const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/append-markdown', {
                    ...payload,
                    dryRun: true
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(prepareConfirmedWriteOperation(result, {
                            affectedIds: [id],
                            operationFingerprint,
                            summary: intent,
                            toolName: OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown
                        }), null, 2)
                    }]
                };
            }

            const confirmed = requireConfirmedWriteOperation(
                { dryRun, operationId, confirmToken },
                {
                    affectedIds: [id],
                    operationFingerprint,
                    summary: intent,
                    toolName: OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown
                }
            );
            const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/append-markdown', {
                ...payload,
                dryRun: false
            });

            writeSafety.recordWriteResult(
                confirmed.operation,
                result.status === 'applied',
                result.status === 'applied' ? undefined : result.reason
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
        OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata,
        'Update note metadata only. Supports title and layout; tags are markdown body tokens and are not handled here.',
        {
            id: z.string().describe('Note ID to update'),
            expectedUpdatedAt: z.string().describe('Expected note updatedAt from a prior read.'),
            title: z.string().optional().describe('New note title'),
            layout: noteLayoutSchema.optional().describe('New note layout'),
            ...confirmedMcpWriteFields
        },
        async ({ id, expectedUpdatedAt, title, layout, dryRun, operationId, confirmToken }) => {
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata);
            const payload = {
                id,
                expectedUpdatedAt,
                ...(title !== undefined ? { title } : {}),
                ...(layout ? { layout } : {})
            };
            const summary = `Update note ${id} metadata`;
            const operationFingerprint = createOperationFingerprint(OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata, payload);

            if (dryRun) {
                const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/metadata', {
                    ...payload,
                    dryRun: true
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(prepareConfirmedWriteOperation(result, {
                            affectedIds: [id],
                            operationFingerprint,
                            summary,
                            toolName: OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata
                        }), null, 2)
                    }]
                };
            }

            const confirmed = requireConfirmedWriteOperation(
                { dryRun, operationId, confirmToken },
                {
                    affectedIds: [id],
                    operationFingerprint,
                    summary,
                    toolName: OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata
                }
            );
            const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/metadata', {
                ...payload,
                dryRun: false
            });

            writeSafety.recordWriteResult(
                confirmed.operation,
                result.status === 'applied',
                result.status === 'applied' ? undefined : result.reason
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
        OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown,
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
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(baseMarkdownSha256 ? { baseMarkdownSha256 } : {}),
                intent,
                replacement,
                ...(policy ? { policy } : {})
            };
            const operationFingerprint = createOperationFingerprint(OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown, payload);

            if (dryRun) {
                const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/replace-markdown', {
                    ...payload,
                    dryRun: true
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(prepareConfirmedWriteOperation(result, {
                            affectedIds: [id],
                            operationFingerprint,
                            summary: intent,
                            toolName: OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown
                        }), null, 2)
                    }]
                };
            }

            const confirmed = requireConfirmedWriteOperation(
                { dryRun, operationId, confirmToken },
                {
                    affectedIds: [id],
                    operationFingerprint,
                    summary: intent,
                    toolName: OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown
                }
            );
            const result = await jsonRequest<DryRunWriteResult>(serverUrl, writeToken, '/api/mcp/notes/replace-markdown', {
                ...payload,
                dryRun: false
            });

            writeSafety.recordWriteResult(
                confirmed.operation,
                result.status === 'applied',
                result.status === 'applied' ? undefined : result.reason
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
        OCEAN_BRAIN_MCP_TOOLS.listTags,
        'List Ocean Brain tags with their note counts.',
        {},
        async () => {
            const data = await graphql(serverUrl, token, `
                query ($searchFilter: SearchFilterInput, $pagination: PaginationInput) {
                    allTags(searchFilter: $searchFilter, pagination: $pagination) {
                        totalCount
                        tags {
                            id
                            name
                            referenceCount
                        }
                    }
                }
            `, {
                searchFilter: { query: '' },
                pagination: { limit: 100, offset: 0 },
            });

            const result = data?.allTags as {
                totalCount: number;
                tags: Array<{ id: string; name: string; referenceCount: number }>;
            };

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2),
                }],
            };
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.listNotesByTag,
        'List Ocean Brain notes for a specific tag name. The tool accepts either @tag or tag and resolves it to the canonical Ocean Brain tag name first.',
        {
            tag: z.string().describe('Tag name to inspect. You can pass @project or project.'),
            limit: z.number().optional().default(20).describe('Max results (default: 20)'),
            offset: z.number().optional().default(0).describe('Pagination offset (default: 0)')
        },
        async ({ tag, limit, offset }) => {
            const normalizedTag = normalizeOceanBrainTagName(tag);
            const tagResult = await fetchOceanBrainTags(serverUrl, token, normalizedTag);
            const exactMatches = tagResult.tags.filter((item) => item.name === normalizedTag);

            if (exactMatches.length === 0) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            requestedTag: tag,
                            normalizedTag,
                            tagFound: false,
                            noteCount: 0,
                            notes: []
                        }, null, 2),
                    }],
                };
            }

            const selectedTag = exactMatches[0];
            const notesData = await graphql(serverUrl, token, `
                query ($searchFilter: SearchFilterInput, $pagination: PaginationInput) {
                    tagNotes(searchFilter: $searchFilter, pagination: $pagination) {
                        totalCount
                        notes {
                            id
                            title
                            updatedAt
                            tags { id name }
                        }
                    }
                }
            `, {
                searchFilter: { query: selectedTag.id },
                pagination: { limit, offset }
            });

            const noteResult = notesData?.tagNotes as {
                totalCount: number;
                notes: Array<{
                    id: string;
                    title: string;
                    updatedAt: string;
                    tags: Array<{ id: string; name: string }>;
                }>;
            };

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        requestedTag: tag,
                        normalizedTag,
                        tagFound: true,
                        duplicateExactMatchCount: exactMatches.length,
                        tag: selectedTag,
                        totalCount: noteResult.totalCount,
                        notes: noteResult.notes.map((note) => ({
                            id: note.id,
                            title: note.title,
                            updatedAt: note.updatedAt,
                            tags: note.tags.map((item) => item.name)
                        }))
                    }, null, 2),
                }],
            };
        }
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.listNotesByTags,
        'List Ocean Brain notes for multiple tag names. Supports AND/OR matching and resolves each input tag to the canonical Ocean Brain tag name first.',
        {
            tags: z.array(z.string()).min(1).describe('Tag names to inspect. You can pass @project or project values.'),
            mode: tagMatchModeSchema.optional().default('and').describe('Tag match mode. Use and for intersection, or for union. Defaults to and.'),
            limit: z.number().optional().default(20).describe('Max results (default: 20)'),
            offset: z.number().optional().default(0).describe('Pagination offset (default: 0)')
        },
        async ({ tags, mode, limit, offset }) => {
            const normalizedTags = normalizeOceanBrainTagNames(tags);
            const tagResults = await Promise.all(
                normalizedTags.map(async (normalizedTag) => {
                    const result = await fetchOceanBrainTags(serverUrl, token, normalizedTag);
                    const exactMatches = result.tags.filter((item) => item.name === normalizedTag);

                    return {
                        normalizedTag,
                        exactMatches
                    };
                })
            );

            const matchedTags = tagResults
                .filter((tagResult) => tagResult.exactMatches.length > 0)
                .map((tagResult) => {
                    const selectedTag = tagResult.exactMatches[0];

                    return {
                        id: selectedTag.id,
                        name: selectedTag.name,
                        referenceCount: selectedTag.referenceCount,
                        duplicateExactMatchCount: tagResult.exactMatches.length
                    };
                });
            const missingTags = tagResults
                .filter((tagResult) => tagResult.exactMatches.length === 0)
                .map((tagResult) => tagResult.normalizedTag);

            let noteResult: {
                totalCount: number;
                notes: Array<{
                    id: string;
                    title: string;
                    updatedAt: string;
                    tags: Array<{ id: string; name: string }>;
                }>;
            } = {
                totalCount: 0,
                notes: []
            };

            if (
                (mode === 'and' && missingTags.length === 0)
                || (mode === 'or' && matchedTags.length > 0)
            ) {
                const notesData = await graphql(serverUrl, token, `
                    query ($tagNames: [String!]!, $mode: TagMatchMode!, $pagination: PaginationInput) {
                        notesByTagNames(tagNames: $tagNames, mode: $mode, pagination: $pagination) {
                            totalCount
                            notes {
                                id
                                title
                                updatedAt
                                tags { id name }
                            }
                        }
                    }
                `, {
                    tagNames: normalizedTags,
                    mode,
                    pagination: { limit, offset }
                });

                noteResult = notesData?.notesByTagNames as typeof noteResult;
            }

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        requestedTags: tags,
                        normalizedTags,
                        mode,
                        allTagsFound: missingTags.length === 0,
                        missingTags,
                        tags: matchedTags,
                        totalCount: noteResult.totalCount,
                        notes: noteResult.notes.map((note) => ({
                            id: note.id,
                            title: note.title,
                            updatedAt: note.updatedAt,
                            tags: note.tags.map((item) => item.name)
                        }))
                    }, null, 2),
                }],
            };
        }
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.listRecentNotes,
        'List recently updated Ocean Brain notes. Returns titles and tags only. Use ocean_brain_read_note to get full content for a specific note.',
        {
            limit: z.number().optional().default(10).describe('Max results (default: 10)'),
        },
        async ({ limit }) => {
            const data = await graphql(serverUrl, token, `
                query ($searchFilter: SearchFilterInput, $pagination: PaginationInput) {
                    allNotes(searchFilter: $searchFilter, pagination: $pagination) {
                        totalCount
                        notes {
                            id
                            title
                            updatedAt
                            tags { id name }
                        }
                    }
                }
            `, {
                searchFilter: { query: '', sortBy: 'updatedAt', sortOrder: 'desc' },
                pagination: { limit, offset: 0 },
            });

            const result = data?.allNotes as {
                totalCount: number;
                notes: Array<{
                    id: string;
                    title: string;
                    updatedAt: string;
                    tags: Array<{ id: string; name: string }>;
                }>;
            };

            const notes = result.notes.map((note) => ({
                id: note.id,
                title: note.title,
                updatedAt: note.updatedAt,
                tags: note.tags.map((t) => t.name),
            }));

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({ totalCount: result.totalCount, notes }, null, 2),
                }],
            };
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.writeSafetyStatus,
        'Inspect pending destructive write confirmations and local operation log state for enabled Ocean Brain MCP write tools.',
        {},
        async () => {
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        ...writeSafety.getStatus(),
                        destructiveWriteTools: [OCEAN_BRAIN_MCP_TOOLS.deleteNote],
                        writeTools: [
                            OCEAN_BRAIN_MCP_TOOLS.createNote,
                            OCEAN_BRAIN_MCP_TOOLS.updateNote,
                            OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown,
                            OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown,
                            OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata,
                            OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown,
                            OCEAN_BRAIN_MCP_TOOLS.createTag,
                            OCEAN_BRAIN_MCP_TOOLS.deleteNote
                        ],
                        writeToolsEnabled: true
                    }, null, 2),
                }],
            };
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.findNoteCleanupCandidates,
        'Find Ocean Brain note cleanup candidates for temporary or draft notes before deletion. Use this before ocean_brain_delete_note.',
        {
            keywords: z.string().optional().default('temp tmp draft test wip')
                .describe('Keywords that mark a note as a cleanup candidate. Comma or space separated.'),
            limit: z.number().optional().default(20).describe('Max results (default: 20)'),
            offset: z.number().optional().default(0).describe('Pagination offset (default: 0)')
        },
        async ({ keywords, limit, offset }) => {
            const normalizedKeywords = keywords
                .split(/[,\s]+/)
                .map((keyword) => keyword.trim())
                .filter(Boolean);
            const data = await graphql(serverUrl, token, `
                query ($query: String, $pagination: PaginationInput) {
                    noteCleanupCandidates(query: $query, pagination: $pagination) {
                        id
                        title
                        updatedAt
                        pinned
                        tagNames
                        reminderCount
                        backReferenceCount
                        matchedTerms
                        reasons
                        requiresForce
                        forceReasons
                    }
                }
            `, {
                query: keywords,
                pagination: { limit, offset }
            });

            const result = data?.noteCleanupCandidates as Array<{
                id: string;
                title: string;
                updatedAt: string;
                pinned: boolean;
                tagNames: string[];
                reminderCount: number;
                backReferenceCount: number;
                matchedTerms: string[];
                reasons: string[];
                requiresForce: boolean;
                forceReasons: string[];
            }>;

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        keywords: normalizedKeywords,
                        limit,
                        offset,
                        candidateCount: result.length,
                        notes: result
                    }, null, 2),
                }],
            };
        }
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.createTag,
        'Create an Ocean Brain tag through the MCP write path. The tool accepts either @tag or tag and creates the canonical Ocean Brain tag if it does not already exist.',
        {
            name: z.string().describe('Tag name to create. You can pass @project or project.')
        },
        async ({ name }) => {
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.createTag);
            const result = await jsonRequest<{
                created: boolean;
                normalizedName: string;
                tag: {
                    id: string;
                    name: string;
                    createdAt: string;
                    updatedAt: string;
                };
            }>(serverUrl, writeToken, '/api/mcp/tags/create', {
                name
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.deleteNote,
        'Delete an Ocean Brain note safely through a dry-run and confirmation flow. Start with dryRun=true, then call again with dryRun=false, operationId, and confirmToken.',
        {
            id: z.string().describe('Note ID to delete'),
            ...destructiveMcpWriteFields
        },
        async ({ id, dryRun, operationId, confirmToken, force }) => {
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.deleteNote);
            const data = await graphql(serverUrl, writeToken, `
                query ($id: ID!) {
                    noteCleanupPreview(id: $id) {
                        id
                        title
                        updatedAt
                        pinned
                        tagNames
                        reminderCount
                        backReferences {
                            id
                            title
                        }
                        orphanedTagNames
                        requiresForce
                        forceReasons
                    }
                }
            `, { id });

            const preview = data?.noteCleanupPreview as {
                id: string;
                title: string;
                updatedAt: string;
                pinned: boolean;
                tagNames: string[];
                reminderCount: number;
                backReferences: Array<{ id: string; title: string }>;
                orphanedTagNames: string[];
                requiresForce: boolean;
                forceReasons: string[];
            } | null;

            if (!preview) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            deleted: false,
                            reason: 'NOTE_NOT_FOUND',
                            id
                        }, null, 2)
                    }]
                };
            }

            const intent = writeSafety.ensureDestructiveWriteRequest(
                { dryRun, operationId, confirmToken, force },
                {
                    actor: 'mcp-bearer',
                    affectedIds: [preview.id],
                    estimatedChangeCount: 1,
                    force: preview.requiresForce,
                    risk: 'destructive',
                    summary: `Delete note ${preview.id} (${preview.title})`,
                    toolName: OCEAN_BRAIN_MCP_TOOLS.deleteNote
                }
            );

            if (intent.kind === 'dry-run') {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            mode: 'dry-run',
                            preview,
                            operation: intent.operation
                        }, null, 2)
                    }]
                };
            }

            if (intent.operation.force && !force) {
                throw new Error(`${OCEAN_BRAIN_MCP_TOOLS.deleteNote} requires force=true because ${preview.forceReasons.join(', ')}.`);
            }

            try {
                const result = await jsonRequest(serverUrl, writeToken, '/api/mcp/notes/delete', {
                    id: preview.id
                });

                writeSafety.recordWriteResult(intent.operation, true);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            mode: 'commit',
                            preview,
                            operation: intent.operation,
                            result
                        }, null, 2)
                    }]
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown MCP note delete error';
                writeSafety.recordWriteResult(intent.operation, false, message);
                throw error;
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
