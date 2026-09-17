import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
    type McpQueryRequest,
    NOTE_SUMMARY_FIELDS,
    noteSummarySchema,
    optionSchema,
    pageInfoSchema,
    propertyKeysSchema,
    QUERY_CONDITION_FIELDS,
    queryConditionsSchema,
} from './mcp-query-tools.js';
import { createMcpJsonToolResult, createPageInfo, pageLimitSchema, pageOffsetSchema } from './mcp-tool-support.js';

const sectionSchema = queryConditionsSchema.extend({
    id: z.string(),
    tabId: z.string(),
    title: z.string(),
    displayType: z.enum(['list', 'table', 'board', 'calendar']),
    limit: z.number(),
    order: z.number(),
    displayOptions: z.object({
        tableColumns: z.array(z.string()),
        tablePropertyKeys: z.array(z.string()),
        boardGroupByPropertyKey: z.string().nullable(),
        calendarDateField: z.enum(['createdAt', 'updatedAt', 'property']),
        calendarDatePropertyKey: z.string().nullable(),
    }),
});
const SECTION_FIELDS = `id tabId title displayType limit order ${QUERY_CONDITION_FIELDS} displayOptions { tableColumns tablePropertyKeys boardGroupByPropertyKey calendarDateField calendarDatePropertyKey }`;
const viewReadSchema = z.object({
    section: sectionSchema,
    totalCount: z.number(),
    rows: z.array(
        z.object({
            note: noteSummarySchema,
            groupValue: z.string().nullable(),
            calendarDate: z.string().nullable(),
        }),
    ),
    groupProperty: z
        .object({
            key: z.string(),
            name: z.string(),
            options: z.array(optionSchema),
        })
        .nullable(),
});

export const registerViewTools = (server: McpServer, request: McpQueryRequest) => {
    server.registerTool(
        'ocean_brain_list_views',
        {
            description:
                'Find saved view sections by section or tab title. Returns IDs, saved conditions and display settings without loading notes or switching the active tab.',
            inputSchema: {
                query: z.string().default(''),
                limit: pageLimitSchema(20, 50),
                offset: pageOffsetSchema,
            },
            outputSchema: {
                totalCount: z.number(),
                views: z.array(
                    z.object({
                        sectionId: z.string(),
                        tabTitle: z.string(),
                        section: sectionSchema,
                    }),
                ),
                page: pageInfoSchema,
            },
            annotations: { readOnlyHint: true },
        },
        async ({ query, limit, offset }) => {
            const data = await request(
                `query ($query: String, $pagination: PaginationInput) { viewSections(query: $query, pagination: $pagination) { totalCount sections { tabTitle section { ${SECTION_FIELDS} } } } }`,
                { query, pagination: { limit, offset } },
            );
            const result = z
                .object({
                    totalCount: z.number(),
                    sections: z.array(z.object({ tabTitle: z.string(), section: sectionSchema })),
                })
                .parse(data?.viewSections);
            return createMcpJsonToolResult({
                totalCount: result.totalCount,
                views: result.sections.map((view) => ({
                    ...view,
                    sectionId: view.section.id,
                })),
                page: createPageInfo(result.totalCount, limit, offset),
            });
        },
    );

    server.registerTool(
        'ocean_brain_read_view',
        {
            description:
                'Read a saved view with its conditions, display settings and paged note rows. Board: omit groupValue for all columns; null means unclassified. Calendar: dateRange is required ([start,end), at most 32 days); saved date field controls order. propertyKeys overrides table columns; omit to use saved table property columns. section.limit is the UI display limit, separate from page.limit.',
            inputSchema: {
                sectionId: z.string().min(1),
                limit: pageLimitSchema(20, 50),
                offset: pageOffsetSchema,
                propertyKeys: propertyKeysSchema.optional(),
                groupValue: z.string().nullable().optional(),
                dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
            },
            outputSchema: {
                ...viewReadSchema.shape,
                selection: z.object({
                    propertyKeys: z.array(z.string()),
                    groupValue: z.string().nullable().optional(),
                    dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
                }),
                page: pageInfoSchema,
            },
            annotations: { readOnlyHint: true },
        },
        async ({ sectionId, limit, offset, propertyKeys, groupValue, dateRange }) => {
            const data = await request(
                `query ($id: ID!, $pagination: PaginationInput, $propertyKeys: [String!], $groupValue: String, $dateRange: DateRangeInput) {
            readViewSection(id: $id, pagination: $pagination, propertyKeys: $propertyKeys, groupValue: $groupValue, dateRange: $dateRange) {
                section { ${SECTION_FIELDS} } totalCount groupProperty { key name options { id label value color order } }
                rows { groupValue calendarDate note { ${NOTE_SUMMARY_FIELDS} } }
            }
        }`,
                {
                    id: sectionId,
                    pagination: { limit, offset },
                    propertyKeys,
                    groupValue,
                    dateRange,
                },
            );
            const result = viewReadSchema.parse(data?.readViewSection);
            const keys =
                propertyKeys ??
                (result.section.displayType === 'table' ? result.section.displayOptions.tablePropertyKeys : []);
            const selection = {
                propertyKeys: keys,
                ...(groupValue !== undefined
                    ? {
                          groupValue: groupValue === null ? null : groupValue.trim().toLowerCase().replace(/\s+/g, '-'),
                      }
                    : {}),
                ...(dateRange ? { dateRange } : {}),
            };
            return createMcpJsonToolResult({
                ...result,
                selection,
                rows: result.rows.map((row) => ({
                    ...row,
                    note: {
                        ...row.note,
                        properties: row.note.properties?.filter((property) => keys.includes(property.key)),
                    },
                })),
                page: createPageInfo(result.totalCount, limit, offset),
            });
        },
    );
};
