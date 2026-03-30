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
        image?: {
            id: string;
            url: string;
            referenceCount: number;
        };
    };

    if (!response.ok) {
        throw new Error(`Request failed: ${result.code || response.status} ${result.message || response.statusText}`);
    }

    return result;
}

const requireWriteToken = (token: string | undefined) => {
    if (token) {
        return token;
    }

    throw new Error('delete_image requires an MCP bearer token. Set --token, --token-file, or --token-env.');
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
        'list_unused_images',
        'List images that are no longer referenced by notes so they can be reviewed before cleanup.',
        {
            limit: z.number().optional().default(20).describe('Max results (default: 20)'),
            offset: z.number().optional().default(0).describe('Pagination offset (default: 0)')
        },
        async ({ limit, offset }) => {
            const data = await graphql(serverUrl, token, `
                query ($pagination: PaginationInput) {
                    allImages(pagination: $pagination) {
                        totalCount
                        images {
                            id
                            url
                            referenceCount
                        }
                    }
                }
            `, {
                pagination: { limit, offset }
            });

            const result = data?.allImages as {
                totalCount: number;
                images: Array<{
                    id: string;
                    url: string;
                    referenceCount: number;
                }>;
            };

            const unusedImages = result.images.filter((image) => image.referenceCount === 0);

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        totalCount: result.totalCount,
                        offset,
                        limit,
                        unusedCount: unusedImages.length,
                        images: unusedImages
                    }, null, 2),
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
                        writeTools: ['delete_image'],
                        writeToolsEnabled: true
                    }, null, 2),
                }],
            };
        },
    );

    server.tool(
        'delete_image',
        'Delete an image safely through a dry-run and confirmation flow. Start with dryRun=true, then call again with dryRun=false, operationId, and confirmToken.',
        {
            id: z.string().describe('Image ID to delete'),
            ...destructiveMcpWriteFields
        },
        async ({ id, dryRun, operationId, confirmToken, force }) => {
            const writeToken = requireWriteToken(token);
            const data = await graphql(serverUrl, writeToken, `
                query ($id: ID!) {
                    image(id: $id) {
                        id
                        url
                        referenceCount
                    }
                }
            `, { id });

            const image = data?.image as {
                id: string;
                url: string;
                referenceCount: number;
            } | null;
            const requiresForce = Boolean(image?.referenceCount && image.referenceCount > 0);

            if (!image) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            deleted: false,
                            reason: 'IMAGE_NOT_FOUND',
                            id
                        }, null, 2)
                    }]
                };
            }

            const intent = writeSafety.ensureDestructiveWriteRequest(
                { dryRun, operationId, confirmToken, force },
                {
                    actor: 'mcp-bearer',
                    affectedIds: [image.id],
                    estimatedChangeCount: 1,
                    force: requiresForce,
                    risk: 'destructive',
                    summary: `Delete image ${image.id} (${image.url})`,
                    toolName: 'delete_image'
                }
            );

            if (intent.kind === 'dry-run') {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            mode: 'dry-run',
                            requiresForce,
                            operation: intent.operation,
                            image
                        }, null, 2)
                    }]
                };
            }

            if (intent.operation.force && !force) {
                throw new Error('delete_image requires force=true because the image is still referenced by notes.');
            }

            try {
                const result = await jsonRequest(serverUrl, writeToken, '/api/mcp/images/delete', {
                    id: image.id
                });

                writeSafety.recordWriteResult(intent.operation, true);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            mode: 'commit',
                            operation: intent.operation,
                            result
                        }, null, 2)
                    }]
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown MCP image delete error';
                writeSafety.recordWriteResult(intent.operation, false, message);
                throw error;
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
