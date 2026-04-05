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

export const OCEAN_BRAIN_MCP_TOOLS = {
    searchNotes: 'ocean_brain_search_notes',
    readNote: 'ocean_brain_read_note',
    createNote: 'ocean_brain_create_note',
    updateNote: 'ocean_brain_update_note',
    listTags: 'ocean_brain_list_tags',
    listNotesByTag: 'ocean_brain_list_notes_by_tag',
    listRecentNotes: 'ocean_brain_list_recent_notes',
    writeSafetyStatus: 'ocean_brain_write_safety_status',
    findNoteCleanupCandidates: 'ocean_brain_find_note_cleanup_candidates',
    createTag: 'ocean_brain_create_tag',
    deleteNote: 'ocean_brain_delete_note'
} as const;

const noteLayoutSchema = z.enum(['narrow', 'wide', 'full']);

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
        'Read an Ocean Brain note by ID. Returns truncated content by default (1000 chars). Set maxLength to 0 only when full content is necessary.',
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
        OCEAN_BRAIN_MCP_TOOLS.createNote,
        'Create an Ocean Brain note from markdown through the MCP write path. This is the preferred way to author new notes without sending internal BlockNote JSON.',
        {
            title: z.string().describe('Note title'),
            markdown: z.string().optional().default('').describe('Markdown body for the new note. Defaults to an empty note body.'),
            layout: noteLayoutSchema.optional().describe('Optional note layout: narrow, wide, or full.')
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
        'Update an Ocean Brain note from markdown through the MCP write path. Pass only the fields you want to change.',
        {
            id: z.string().describe('Note ID to update'),
            title: z.string().optional().describe('New note title'),
            markdown: z.string().optional().describe('Replacement markdown body'),
            layout: noteLayoutSchema.optional().describe('Optional note layout: narrow, wide, or full.')
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
            const tagsData = await graphql(serverUrl, token, `
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
                searchFilter: { query: normalizedTag },
                pagination: { limit: 100, offset: 0 }
            });

            const tagResult = tagsData?.allTags as {
                totalCount: number;
                tags: Array<{ id: string; name: string; referenceCount: number }>;
            };
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
