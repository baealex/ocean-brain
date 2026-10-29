import { registerWorkspaceTools, resolvedScopeSchema, workspaceIdSchema, workspaceScopeSchema } from './mcp-workspace-tools.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { metadataPropertyPatchSchema, registerIntentWriteTools } from './mcp-intent-write-tools.js';
import { createMcpReadNoteResult } from './mcp-note-output.js';
import { registerQueryTools } from './mcp-query-tools.js';
import {
    createMcpJsonToolResult,
    createPageInfo,
    noteLayoutSchema,
    pageLimitSchema,
    pageOffsetSchema,
} from './mcp-tool-support.js';
import { registerViewTools } from './mcp-view-tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')) as {
    oceanBrain?: { mcpCompatibilityVersion?: string };
    version: string;
};

if (!pkg.oceanBrain?.mcpCompatibilityVersion) {
    throw new Error('Ocean Brain MCP compatibility version is required in package metadata.');
}

export const OCEAN_BRAIN_MCP_VERSION_HEADER = 'X-Ocean-Brain-MCP-Version';
export const OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER = 'X-Ocean-Brain-MCP-Compatibility-Version';
export const OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER = 'X-Ocean-Brain-MCP-Client-Version';
export const OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION = pkg.oceanBrain.mcpCompatibilityVersion;

export const createMcpRequestHeaders = (token: string | undefined) => ({
    'Content-Type': 'application/json',
    [OCEAN_BRAIN_MCP_VERSION_HEADER]: OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION,
    [OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER]: OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION,
    [OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER]: pkg.version,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const OCEAN_BRAIN_MCP_TOOLS = {
    queryNotes: 'ocean_brain_query_notes',
    listViews: 'ocean_brain_list_views',
    readView: 'ocean_brain_read_view',
    searchNotes: 'ocean_brain_search_notes',
    readNote: 'ocean_brain_read_note',
    createNote: 'ocean_brain_create_note',
    patchNoteMarkdown: 'ocean_brain_patch_note_markdown',
    appendNoteMarkdown: 'ocean_brain_append_note_markdown',
    updateNoteMetadata: 'ocean_brain_update_note_metadata',
    replaceNoteMarkdown: 'ocean_brain_replace_note_markdown',
    listTags: 'ocean_brain_list_tags',
    listProperties: 'ocean_brain_list_properties',
    listWorkspaces: 'ocean_brain_list_workspaces',
    deleteNote: 'ocean_brain_delete_note',
} as const;

const searchModeSchema = z.enum(['hybrid', 'lexical', 'semantic']);

const graphqlSearchModes = {
    hybrid: 'HYBRID',
    lexical: 'LEXICAL',
    semantic: 'SEMANTIC',
} as const;

interface McpGraphqlErrorShape {
    message: string;
    extensions?: {
        code?: string;
        operationId?: string;
    };
}

const formatMcpGraphqlError = (error: McpGraphqlErrorShape) => {
    const suffix: string[] = [];

    if (error.extensions?.code) {
        suffix.push(`code=${error.extensions.code}`);
    }

    if (error.extensions?.operationId) {
        suffix.push(`operationId=${error.extensions.operationId}`);
    }

    if (suffix.length === 0) {
        return `GraphQL error: ${error.message}`;
    }

    return `GraphQL error: ${error.message} (${suffix.join(', ')})`;
};

async function graphql(
    serverUrl: string,
    token: string | undefined,
    query: string,
    variables?: Record<string, unknown>,
) {
    const response = await fetch(`${serverUrl}/api/integrations/v1/graphql`, {
        method: 'POST',
        headers: createMcpRequestHeaders(token),
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const errorBody = (await response.json().catch(() => undefined)) as
            | { code?: string; message?: string }
            | undefined;
        throw new Error(
            errorBody?.message
                ? `GraphQL request failed: ${errorBody.code || response.status} ${errorBody.message}`
                : `GraphQL request failed: ${response.status} ${response.statusText}`,
        );
    }

    const result = (await response.json()) as {
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
    body: Record<string, unknown>,
) {
    const response = await fetch(`${serverUrl}${pathName}`, {
        method: 'POST',
        headers: createMcpRequestHeaders(token),
        body: JSON.stringify(body),
    });

    const result = (await response.json()) as TResponse & {
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

interface McpSearchNote {
    workspaceId?: string;
    id: string;
    title: string;
    updatedAt: string;
    tags: Array<{ id: string; name: string }>;
    contentPreview: string;
}

const formatMcpSearchNotes = (notes: McpSearchNote[]) =>
    notes.map((note) => ({
        ...(note.workspaceId ? { workspaceId: note.workspaceId } : {}),
        id: note.id,
        title: note.title,
        updatedAt: note.updatedAt,
        tags: note.tags.map((t) => t.name),
        preview: note.contentPreview,
    }));

interface RegisterMcpToolsOptions {
    graphqlRequest?: typeof graphql;
}

export const registerMcpTools = (
    server: McpServer,
    serverUrl: string,
    token?: string,
    options: RegisterMcpToolsOptions = {},
) => {
    const graphqlRequest = options.graphqlRequest ?? graphql;
    const queryRequest = (query: string, variables: Record<string, unknown>) =>
        graphqlRequest(serverUrl, token, query, variables);
    registerWorkspaceTools(server, queryRequest);
    registerQueryTools(server, queryRequest);
    registerViewTools(server, queryRequest);

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.searchNotes,
        'Search Ocean Brain notes by keyword or meaning. Lexical uses words only, hybrid combines words and meaning, and semantic uses meaning only. Results use one ranked result shape with match and semantic-search status. Use ocean_brain_read_note to get full content for a specific note.',
        {
            scope: workspaceScopeSchema.optional(),
            query: z.string().describe('Search words or a natural-language description'),
            limit: pageLimitSchema(10, 50).describe(
                'Results per page. Search returns at most 50 per page. (default: 10)',
            ),
            offset: z
                .number()
                .int()
                .min(0)
                .optional()
                .default(0)
                .describe('Results to skip for pagination (default: 0)'),
            mode: searchModeSchema.default('hybrid').describe('Search mode. Defaults to hybrid.'),
        },
        async ({ query, limit, offset, mode, scope }) => {
            const data = await graphqlRequest(
                serverUrl,
                token,
                `
                query ($query: String!, $mode: SearchMode!, $pagination: PaginationInput!, $scope: WorkspaceScopeInput) {
                    searchNotes(query: $query, mode: $mode, pagination: $pagination, scope: $scope) {
                        resolvedScope { kind workspaceId }
                        totalCount
                        semanticAvailable
                        semanticUsed
                        semanticError
                        matches {
                            noteId
                            lexical
                            semantic
                            excerpt { text source start end }
                        }
                        notes {
                            workspaceId
                            id
                            title
                            updatedAt
                            tags { id name }
                            contentPreview
                        }
                    }
                }
            `,
                {
                    ...(scope ? { scope } : {}),
                    query,
                    mode: graphqlSearchModes[mode],
                    pagination: { limit, offset },
                },
            );

            const result = data?.searchNotes as {
                resolvedScope?: z.infer<typeof resolvedScopeSchema>;
                totalCount: number;
                semanticAvailable: boolean;
                semanticUsed: boolean;
                semanticError: string | null;
                matches: Array<{
                    noteId: string;
                    lexical: boolean;
                    semantic: boolean;
                }>;
                notes: McpSearchNote[];
            };

            return createMcpJsonToolResult({
                ...(result.resolvedScope ? { resolvedScope: resolvedScopeSchema.parse(result.resolvedScope) } : {}),
                totalCount: result.totalCount,
                semanticAvailable: result.semanticAvailable,
                semanticUsed: result.semanticUsed,
                semanticError: result.semanticError,
                matches: result.matches,
                page: createPageInfo(result.totalCount, limit, offset),
                notes: formatMcpSearchNotes(result.notes),
            });
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.readNote,
        'Read note Markdown, metadata, backlinks and linkedViews. linkedViews covers the whole note; follow available viewIds with read_view.',
        {
            id: z.string().min(1),
            maxLength: z.number().int().nonnegative().default(1000).describe('UTF-16 units; 0 reads the remaining body or selected section.'),
            offset: z.number().int().nonnegative().optional().describe('Continuation: use contentRange.nextOffset with expectedUpdatedAt. Cannot combine with heading.'),
            heading: z.string().min(1).optional().describe('Exact heading; ambiguous matches return positions.'),
            expectedUpdatedAt: z.string().optional().describe('Note version from the preceding read.'),
            backlinkContext: z.object({ limit: pageLimitSchema(20, 50), offset: pageOffsetSchema }).optional().describe('Include backlink excerpts.'),
        },
        async (input) => {
            if (input.heading !== undefined && input.offset !== undefined)
                throw new Error('Use either heading or offset, not both.');
            const { backlinkContext, ...readInput } = input;
            const contextVariables = backlinkContext ? ', $backlinkLimit: Int, $backlinkOffset: Int' : '';
            const referenceQuery = backlinkContext
                ? 'backReferenceDetails(id: $id, limit: $backlinkLimit, offset: $backlinkOffset) { references { id title hasMoreContexts contexts { blockId segments { text isTarget } } } hasMore nextOffset }'
                : 'backReferences(id: $id) { id title }';
            const data = await graphqlRequest(
                serverUrl,
                token,
                `
                query ($id: ID!, $maxLength: Int, $offset: Int, $heading: String, $expectedUpdatedAt: String${contextVariables}) {
                    noteRead(id: $id, maxLength: $maxLength, offset: $offset, heading: $heading, expectedUpdatedAt: $expectedUpdatedAt) {
                        status reason message markdown
                        candidates { heading level start end }
                        linkedViews { workspaceId viewId title groupId groupTitle displayType status }
                        contentRange { start end totalLength sectionEnd hasMore nextOffset }
                        note { workspaceId workspace { id name archivedAt } id title createdAt updatedAt tags { id name } properties { key name value valueType option { label value } } }
                    }
                    ${referenceQuery}
                }
            `,
                { ...readInput, ...(backlinkContext ? { backlinkLimit: backlinkContext.limit, backlinkOffset: backlinkContext.offset } : {}) },
            );
            return createMcpReadNoteResult(data?.noteRead, data?.backReferences, data?.backReferenceDetails);
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.createNote,
        'Create a note from Markdown, optionally within a saved view. Search first to avoid duplicates.',
        {
            workspaceId: workspaceIdSchema.optional().describe('Target space; omitted uses the default space unless a view selects its own.'),
            title: z.string().describe('Note title'),
            viewContext: z.object({
                viewId: z.string().regex(/^[1-9]\d*$/),
                groupValue: z.string().nullable().optional().describe('Board option value; null means Unassigned.'),
                tagNames: z.array(z.string()).max(50).optional().describe('Explicit OR tag choices.'),
            }).strict().optional().describe('Inherits AND tags and equality values. Supply other required values through properties; the note must match the view.'),
            markdown: z
                .string()
                .optional()
                .default('')
                .describe(
                    'Note body; overrides the default template. Write tags as [@tag].',
                ),
            layout: noteLayoutSchema
                .optional()
                .describe(
                    'Note width; prefer wide unless requested otherwise.',
                ),
            properties: z
                .object({
                    set: z.array(z.object({ key: z.string().min(1), value: z.string() })).max(50).optional(),
                    deleteKeys: z.array(z.string().min(1)).max(50).optional().describe('Omit inherited template properties; requires viewContext.'),
                })
                .strict()
                .optional()
                .describe(
                    'Existing property keys and values, saved atomically with the note.',
                ),
        },
        async ({ title, markdown, layout, properties, viewContext, workspaceId }) => {
            if (properties) metadataPropertyPatchSchema.parse(properties);
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.createNote);
            const result = await jsonRequest<{
                created: boolean;
                note: {
                    workspaceId?: string;
                    id: string;
                    title: string;
                    layout: 'narrow' | 'wide' | 'full';
                    createdAt: string;
                    updatedAt: string;
                };
            }>(serverUrl, writeToken, '/api/integrations/v1/notes/create', {
                ...(workspaceId ? { workspaceId } : {}),
                title,
                markdown,
                ...(layout ? { layout } : {}),
                ...(properties ? { properties } : {}),
                ...(viewContext ? { viewContext } : {}),
            });

            return createMcpJsonToolResult(result);
        },
    );

    registerIntentWriteTools(server, {
        jsonRequest,
        requireWriteToken,
        serverUrl,
        token,
        tools: OCEAN_BRAIN_MCP_TOOLS,
    });

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.listTags,
        'Search and page through Ocean Brain tags that are used by notes, with note counts.',
        {
            scope: workspaceScopeSchema.optional(),
            query: z.string().default('').describe('Tag name search'),
            limit: pageLimitSchema(100),
            offset: pageOffsetSchema,
        },
        async ({ query, limit, offset, scope }) => {
            const data = await graphqlRequest(
                serverUrl,
                token,
                `
                query ($searchFilter: SearchFilterInput, $pagination: PaginationInput, $scope: WorkspaceScopeInput) {
                    allTags(searchFilter: $searchFilter, pagination: $pagination, scope: $scope) {
                        resolvedScope { kind workspaceId }
                        totalCount
                        tags {
                            id
                            name
                            referenceCount
                        }
                    }
                }
            `,
                {
                    ...(scope ? { scope } : {}),
                    searchFilter: { query },
                    pagination: { limit, offset },
                },
            );

            const result = data?.allTags as {
                resolvedScope?: z.infer<typeof resolvedScopeSchema>;
                totalCount: number;
                tags: Array<{ id: string; name: string; referenceCount: number }>;
            };

            return createMcpJsonToolResult({
                ...result,
                page: createPageInfo(result.totalCount, limit, offset),
            });
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.listProperties,
        'List shared Ocean Brain property definitions. Use this before property queries so keys, value types, and select option values are valid.',
        {
            scope: workspaceScopeSchema.optional(),
            query: z.string().optional().default('').describe('Optional property key/name search query'),
            limit: pageLimitSchema(50, 100).describe('Max results (default: 50, server max: 100)'),
            offset: pageOffsetSchema.describe('Pagination offset (default: 0)'),
        },
        async ({ query, limit, offset, scope }) => {
            const data = await graphqlRequest(
                serverUrl,
                token,
                `
                query ($query: String, $pagination: PaginationInput, $scope: WorkspaceScopeInput) {
                    notePropertyKeys(query: $query, pagination: $pagination, scope: $scope) {
                        resolvedScope { kind workspaceId }
                        totalCount
                        keys {
                            workspaceId
                            key
                            name
                            valueType
                            noteCount
                            updatedAt
                            options { id label value color order }
                        }
                    }
                }
            `,
                {
                    ...(scope ? { scope } : {}),
                    query,
                    pagination: { limit, offset },
                },
            );

            const result = data?.notePropertyKeys as {
                resolvedScope?: z.infer<typeof resolvedScopeSchema>;
                totalCount: number;
                keys: Array<{
                    workspaceId?: string;
                    key: string;
                    name: string;
                    valueType: 'text' | 'url' | 'number' | 'date' | 'boolean' | 'select';
                    noteCount: number;
                    updatedAt: string;
                    options: Array<{
                        id: string;
                        label: string;
                        value: string;
                        color?: string | null;
                        order: number;
                    }>;
                }>;
            };

            return createMcpJsonToolResult({
                ...(result.resolvedScope ? { resolvedScope: resolvedScopeSchema.parse(result.resolvedScope) } : {}),
                totalCount: result.totalCount,
                propertyKeys: result.keys,
                page: createPageInfo(result.totalCount, limit, offset),
            });
        },
    );

    server.tool(
        OCEAN_BRAIN_MCP_TOOLS.deleteNote,
        'Move an Ocean Brain note to trash, like `mv note.md trash/`. This is a recoverable trash move, not permanent deletion. Deleted-note tag names are kept as restore metadata; orphan tags are not a blocking condition.',
        {
            id: z.string().describe('Note ID to move to trash'),
        },
        async ({ id }) => {
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.deleteNote);

            try {
                const result = await jsonRequest(serverUrl, writeToken, '/api/integrations/v1/notes/delete', { id });

                return createMcpJsonToolResult(result);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown MCP note delete error';
                throw new Error(message);
            }
        },
    );
};

export async function startMcpServer(serverUrl: string, token?: string) {
    const server = new McpServer({
        name: 'ocean-brain',
        version: pkg.version,
    });
    registerMcpTools(server, serverUrl, token);

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
