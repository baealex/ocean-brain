import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createMcpJsonToolResult, createPageInfo, pageLimitSchema, pageOffsetSchema } from './mcp-tool-support.js';

export type McpQueryRequest = (
    query: string,
    variables: Record<string, unknown>,
) => Promise<Record<string, unknown> | undefined>;

export const propertyFilterSchema = z.object({
    key: z.string().min(1),
    valueType: z.enum(['text', 'url', 'number', 'date', 'boolean', 'select']),
    operator: z.enum(['equals', 'notEquals', 'contains', 'notContains', 'before', 'after', 'exists', 'notExists']),
    value: z
        .string()
        .nullable()
        .optional()
        .describe(
            'Required except exists/notExists. select=option.value, date=YYYY-MM-DD, boolean=true/false. contains/notContains: text/url; before/after: date/number.',
        ),
});
export const queryConditionsSchema = z.object({
    tagNames: z.array(z.string()),
    mode: z.enum(['and', 'or']),
    propertyFilters: z.array(propertyFilterSchema.extend({ name: z.string().optional() })),
    sortBy: z.enum(['updatedAt', 'createdAt', 'title']),
    sortOrder: z.enum(['asc', 'desc']),
});
export const optionSchema = z.object({
    id: z.string(),
    label: z.string(),
    value: z.string(),
    color: z.string().nullable(),
    order: z.number(),
});
export const noteSummarySchema = z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    tags: z.array(z.object({ id: z.string(), name: z.string() })),
    properties: z
        .array(
            z.object({
                key: z.string(),
                name: z.string(),
                value: z.string(),
                valueType: z.string(),
                option: optionSchema.nullable(),
            }),
        )
        .optional(),
});
export const pageInfoSchema = z.object({
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
    nextOffset: z.number().nullable(),
});
export const propertyKeysSchema = z
    .array(z.string().trim().min(1))
    .max(50)
    .transform((keys) => [...new Set(keys.map((key) => key.toLowerCase().replace(/\s+/g, '-')))]);
export const NOTE_SUMMARY_FIELDS =
    'id title createdAt updatedAt tags { id name } properties(keys: $propertyKeys) { key name value valueType option { id label value color order } }';
export const QUERY_CONDITION_FIELDS =
    'tagNames mode propertyFilters { key name valueType operator value } sortBy sortOrder';

export const registerQueryTools = (server: McpServer, request: McpQueryRequest) => {
    server.registerTool(
        'ocean_brain_query_notes',
        {
            description:
                'Query notes using tags and property conditions; no filters returns recent notes. mode combines tags only; property filters always use AND. Use list_properties for valid keys/types/options. Only requested propertyKeys are returned. No note bodies.',
            inputSchema: {
                tagNames: z.array(z.string().trim().min(1)).max(100).default([]),
                mode: z.enum(['and', 'or']).default('and'),
                propertyFilters: z.array(propertyFilterSchema).max(10).default([]),
                sortBy: z.enum(['updatedAt', 'createdAt', 'title']).default('updatedAt'),
                sortOrder: z.enum(['asc', 'desc']).default('desc'),
                propertyKeys: propertyKeysSchema.default([]),
                limit: pageLimitSchema(20, 50),
                offset: pageOffsetSchema,
            },
            outputSchema: {
                query: queryConditionsSchema,
                totalCount: z.number(),
                notes: z.array(noteSummarySchema),
                missingTags: z.array(z.string()),
                page: pageInfoSchema,
            },
            annotations: { readOnlyHint: true },
        },
        async ({ limit, offset, propertyKeys, ...input }) => {
            const data = await request(
                `query ($input: NotesByPropertiesInput!, $names: [String!]!, $pagination: PaginationInput!, $propertyKeys: [String!]) {
            notesByQuery(input: $input, pagination: $pagination) { query { ${QUERY_CONDITION_FIELDS} } totalCount notes { ${NOTE_SUMMARY_FIELDS} } }
            tagsByNames(names: $names) { name }
        }`,
                {
                    input,
                    names: input.tagNames,
                    propertyKeys,
                    pagination: { limit, offset },
                },
            );
            const result = z
                .object({
                    query: queryConditionsSchema,
                    totalCount: z.number(),
                    notes: z.array(noteSummarySchema),
                })
                .parse(data?.notesByQuery);
            const tags = z.array(z.object({ name: z.string() })).parse(data?.tagsByNames);
            return createMcpJsonToolResult({
                ...result,
                missingTags: result.query.tagNames.filter((name) => !tags.some((tag) => tag.name === name)),
                page: createPageInfo(result.totalCount, limit, offset),
            });
        },
    );
};
