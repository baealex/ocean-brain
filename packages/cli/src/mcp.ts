import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { formatMcpReadNoteOutput } from './mcp-note-output.js';
import { registerIntentWriteTools } from './mcp-intent-write-tools.js';
import { formatPropertyQueryResponse, type PropertyQueryResult } from './mcp-property-query-output.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
) as { oceanBrain?: { mcpCompatibilityVersion?: string }; version: string };

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
    ...(token ? { Authorization: `Bearer ${token}` } : {})
});

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
    listProperties: 'ocean_brain_list_properties',
    queryNotesByProperties: 'ocean_brain_query_notes_by_properties',
    listNotesByTag: 'ocean_brain_list_notes_by_tag',
    listNotesByTags: 'ocean_brain_list_notes_by_tags',
    listRecentNotes: 'ocean_brain_list_recent_notes',
    findNoteCleanupCandidates: 'ocean_brain_find_note_cleanup_candidates',
    createTag: 'ocean_brain_create_tag',
    deleteNote: 'ocean_brain_delete_note'
} as const;

const noteLayoutSchema = z.enum(['narrow', 'wide', 'full']);
const tagMatchModeSchema = z.enum(['and', 'or']);
const propertyValueTypeSchema = z.enum(['text', 'url', 'number', 'date', 'boolean', 'select']);
const propertyFilterOperatorSchema = z.enum(['equals', 'before', 'after', 'exists', 'notExists']);
const viewSortBySchema = z.enum(['updatedAt', 'createdAt', 'title']);
const viewSortOrderSchema = z.enum(['asc', 'desc']);

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

const propertyFilterSchema = z.object({
    key: z.string().describe('Property key from ocean_brain_list_properties, e.g. state'),
    valueType: propertyValueTypeSchema.describe('Property value type from the property definition'),
    operator: propertyFilterOperatorSchema.describe('Filter operator. before/after are only valid for date or number properties.'),
    value: z.string().nullable().optional().describe('Filter value. Required unless operator is exists or notExists. select=option.value, date=YYYY-MM-DD, boolean=true/false, number=finite, url=http(s).')
});

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
        headers: createMcpRequestHeaders(token),
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => undefined) as
            | { code?: string; message?: string }
            | undefined;
        throw new Error(
            errorBody?.message
                ? `GraphQL request failed: ${errorBody.code || response.status} ${errorBody.message}`
                : `GraphQL request failed: ${response.status} ${response.statusText}`
        );
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
        headers: createMcpRequestHeaders(token),
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
    token?: string
) {
    const server = new McpServer({
        name: 'ocean-brain',
        version: pkg.version,
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
        'Read an Ocean Brain note by ID. Returns properties, tags, truncated content by default (1000 chars), and a back-reference summary. Set maxLength to 0 only when full content is necessary.',
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
                        properties { key name value valueType option { id label value color order } }
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
                properties?: Array<{
                    key: string;
                    name: string;
                    value: string;
                    valueType: string;
                    option?: { id: string; label: string; value: string; color?: string | null; order: number } | null;
                }>;
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
        'Legacy full-field note update kept for backward compatibility. Prefer ocean_brain_patch_note_markdown for localized body edits, ocean_brain_append_note_markdown for additions, ocean_brain_replace_note_markdown for whole-body rewrites, and ocean_brain_update_note_metadata for title/layout/properties. Use this only when a legacy client needs combined field updates.',
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

    registerIntentWriteTools(server, {
        jsonRequest,
        requireWriteToken,
        serverUrl,
        token,
        tools: OCEAN_BRAIN_MCP_TOOLS
    });

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
        OCEAN_BRAIN_MCP_TOOLS.listProperties,
        'List shared Ocean Brain property definitions. Use this before property queries so keys, value types, and select option values are valid.',
        {
            query: z.string().optional().default('').describe('Optional property key/name search query'),
            limit: z.number().optional().default(50).describe('Max results (default: 50, server max: 100)'),
            offset: z.number().optional().default(0).describe('Pagination offset (default: 0)')
        },
        async ({ query, limit, offset }) => {
            const data = await graphql(serverUrl, token, `
                query ($query: String, $pagination: PaginationInput) {
                    notePropertyKeys(query: $query, pagination: $pagination) {
                        totalCount
                        keys {
                            key
                            name
                            valueType
                            noteCount
                            updatedAt
                            options { id label value color order }
                        }
                    }
                }
            `, {
                query,
                pagination: { limit, offset }
            });

            const result = data?.notePropertyKeys as {
                totalCount: number;
                keys: Array<{
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

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        totalCount: result.totalCount,
                        propertyKeys: result.keys
                    }, null, 2),
                }],
            };
        }
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
        OCEAN_BRAIN_MCP_TOOLS.queryNotesByProperties,
        'Call ocean_brain_list_properties first. Requires >=1 propertyFilter; use search/recent for broad lists. Use key/valueType from the property definition. Values are strings: select=option.value, date=YYYY-MM-DD, boolean=true/false, number=finite, url=http(s). exists/notExists need no value. Property filters use AND; tagNames use mode. Summaries are returned by default; use propertyKeys for needed property details.',
        {
            propertyFilters: z.array(propertyFilterSchema).min(1).max(10).describe('Required property filters. Multiple property filters are combined with AND.'),
            tagNames: z.array(z.string()).optional().default([]).describe('Optional tag filters. You can pass @project, #project, or project.'),
            mode: tagMatchModeSchema.optional().default('and').describe('Tag match mode for tagNames only. Property filters are always combined with AND.'),
            sortBy: viewSortBySchema.optional().default('updatedAt').describe('Sort field (default: updatedAt)'),
            sortOrder: viewSortOrderSchema.optional().default('desc').describe('Sort order (default: desc)'),
            includeProperties: z.boolean().optional().default(false).describe('Include returned note properties. Defaults to false to reduce tokens.'),
            propertyKeys: z.array(z.string()).optional().default([]).describe('Property keys to include in output; automatically includes properties.'),
            limit: z.number().optional().default(20).describe('Max results (default: 20, server max: 50)'),
            offset: z.number().optional().default(0).describe('Pagination offset (default: 0)')
        },
        async ({ propertyFilters, tagNames, mode, sortBy, sortOrder, includeProperties, propertyKeys, limit, offset }) => {
            const shouldIncludeProperties = includeProperties || propertyKeys.length > 0;
            const data = await graphql(serverUrl, token, `
                query ($input: NotesByPropertiesInput!, $pagination: PaginationInput, $includeProperties: Boolean!) {
                    notesByProperties(input: $input, pagination: $pagination) {
                        totalCount
                        notes {
                            id
                            title
                            createdAt
                            updatedAt
                            tags { id name }
                            properties @include(if: $includeProperties) { key name value valueType option { id label value color order } }
                        }
                    }
                }
            `, {
                input: {
                    tagNames,
                    mode,
                    propertyFilters,
                    sortBy,
                    sortOrder
                },
                pagination: { limit, offset },
                includeProperties: shouldIncludeProperties
            });

            const result = data?.notesByProperties as PropertyQueryResult;

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(
                        formatPropertyQueryResponse({
                            result,
                            query: {
                                propertyFilters,
                                tagNames,
                                mode,
                                sortBy,
                                sortOrder,
                                limit,
                                offset
                            },
                            includeProperties: shouldIncludeProperties,
                            propertyKeys
                        }),
                        null,
                        2
                    ),
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
        OCEAN_BRAIN_MCP_TOOLS.findNoteCleanupCandidates,
        'Find Ocean Brain note cleanup candidates for temporary or draft notes before deletion. This is optional discovery; ocean_brain_delete_note moves a single note to trash directly.',
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
        'Move an Ocean Brain note to trash, like `mv note.md trash/`. This is a recoverable trash move, not permanent deletion. Deleted-note tag names are kept as restore metadata; orphan tags are not a blocking condition.',
        {
            id: z.string().describe('Note ID to move to trash')
        },
        async ({ id }) => {
            const writeToken = requireWriteToken(token, OCEAN_BRAIN_MCP_TOOLS.deleteNote);

            try {
                const result = await jsonRequest(serverUrl, writeToken, '/api/mcp/notes/delete', { id });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown MCP note delete error';
                throw new Error(message);
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
