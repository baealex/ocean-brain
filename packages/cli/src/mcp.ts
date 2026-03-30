import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
    createMcpWriteSafetyCoordinator,
    defaultMcpWriteSafetyDir,
    destructiveMcpWriteFields,
    formatMcpGraphqlError
} from './mcp-write-safety.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
);

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

async function jsonRequest(
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

    const result = await response.json() as {
        code?: string;
        message?: string;
        deleted?: boolean;
        note?: {
            id: string;
            title: string;
        };
    };

    if (!response.ok) {
        throw new Error(`Request failed: ${result.code || response.status} ${result.message || response.statusText}`);
    }

    return result;
}

const requireWriteToken = (token: string | undefined, toolName: string) => {
    if (token) {
        return token;
    }

    throw new Error(`${toolName} requires an MCP bearer token. Set --token, --token-file, or --token-env.`);
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

    server.tool(
        'search_notes',
        'Search notes by keyword. Returns a list of matching notes with title and tags. Use read_note to get full content of a specific note.',
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
        'read_note',
        'Read content of a note by ID. Returns truncated by default (1000 chars). Set maxLength to 0 for full content only when necessary.',
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

            let markdown = note.contentAsMarkdown;
            const totalLength = markdown.length;
            let truncated = false;
            if (maxLength > 0 && markdown.length > maxLength) {
                markdown = markdown.slice(0, maxLength);
                truncated = true;
            }

            const output = [
                `# ${note.title}`,
                '',
                `Tags: ${note.tags.map((t) => t.name).join(', ') || '(none)'}`,
                `Created: ${note.createdAt}`,
                `Updated: ${note.updatedAt}`,
                ...(truncated ? [`Content: ${totalLength} chars (showing first ${maxLength})`] : []),
                '',
                markdown,
                ...(truncated ? ['\n... (truncated, use maxLength: 0 to read full content)'] : []),
            ].join('\n');

            return {
                content: [{
                    type: 'text' as const,
                    text: output,
                }],
            };
        },
    );

    server.tool(
        'list_tags',
        'List all tags with their note counts.',
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
        'list_recent_notes',
        'List recently updated notes. Returns titles and tags only. Use read_note to get content of a specific note.',
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
        'mcp_write_safety_status',
        'Inspect the pending destructive write confirmations and local operation log state for enabled MCP write tools.',
        {},
        async () => {
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        ...writeSafety.getStatus(),
                        writeTools: ['delete_note'],
                        writeToolsEnabled: true
                    }, null, 2),
                }],
            };
        },
    );

    server.tool(
        'find_note_cleanup_candidates',
        'Find candidate notes for temporary or draft cleanup before deletion. Use this before delete_note.',
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
        'delete_note',
        'Delete a note safely through a dry-run and confirmation flow. Start with dryRun=true, then call again with dryRun=false, operationId, and confirmToken.',
        {
            id: z.string().describe('Note ID to delete'),
            ...destructiveMcpWriteFields
        },
        async ({ id, dryRun, operationId, confirmToken, force }) => {
            const writeToken = requireWriteToken(token, 'delete_note');
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
                    toolName: 'delete_note'
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
                throw new Error(`delete_note requires force=true because ${preview.forceReasons.join(', ')}.`);
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
