import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
    type McpQueryRequest,
    NOTE_SUMMARY_FIELDS,
    noteSummarySchema,
    optionSchema,
    pageInfoSchema,
    propertyKeysSchema,
} from './mcp-query-tools.js';
import { VIEW_FIELDS, viewSchema } from './mcp-view-schema.js';
import { createMcpJsonToolResult, createPageInfo, pageLimitSchema, pageOffsetSchema } from './mcp-tool-support.js';

const viewReadSchema = z.object({
    view: viewSchema,
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
                'Find saved views by view or view group title. A view stores filters, sorting and a display format; a view group organizes views. Returns IDs and saved settings without loading notes or switching groups. Use viewId to read a view; groupTitle is its group name.',
            inputSchema: {
                query: z.string().default(''),
                limit: pageLimitSchema(20, 50),
                offset: pageOffsetSchema,
            },
            outputSchema: {
                totalCount: z.number(),
                views: z.array(
                    z.object({
                        viewId: z.string().describe('Saved view ID to pass to ocean_brain_read_view.'),
                        groupTitle: z.string().describe('View group name.'),
                        view: viewSchema,
                    }),
                ),
                page: pageInfoSchema,
            },
            annotations: { readOnlyHint: true },
        },
        async ({ query, limit, offset }) => {
            const data = await request(
                `query ($query: String, $pagination: PaginationInput) { views(query: $query, pagination: $pagination) { totalCount views { groupTitle view { ${VIEW_FIELDS} } } } }`,
                { query, pagination: { limit, offset } },
            );
            const result = z
                .object({
                    totalCount: z.number(),
                    views: z.array(z.object({ groupTitle: z.string(), view: viewSchema })),
                })
                .parse(data?.views);
            return createMcpJsonToolResult({
                totalCount: result.totalCount,
                views: result.views.map((view) => ({
                    ...view,
                    viewId: view.view.id,
                })),
                page: createPageInfo(result.totalCount, limit, offset),
            });
        },
    );

    server.registerTool(
        'ocean_brain_read_view',
        {
            description:
                'Read one saved view by viewId, with its filters, display format and paged note rows. View groups organize views; this reads an individual view. Board: omit groupValue for all columns; null means unclassified. Calendar: dateRange is required ([start,end), at most 32 days); saved date field controls order. propertyKeys overrides table columns; omit to use saved table property columns. view.limit is the saved view display limit, separate from page.limit.',
            inputSchema: {
                viewId: z.string().min(1).describe('Saved view ID returned by ocean_brain_list_views.'),
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
        async ({ viewId, limit, offset, propertyKeys, groupValue, dateRange }) => {
            const data = await request(
                `query ($id: ID!, $pagination: PaginationInput, $propertyKeys: [String!], $groupValue: String, $dateRange: DateRangeInput) {
            readView(id: $id, pagination: $pagination, propertyKeys: $propertyKeys, groupValue: $groupValue, dateRange: $dateRange) {
                view { ${VIEW_FIELDS} } totalCount groupProperty { key name options { id label value color order } }
                rows { groupValue calendarDate note { ${NOTE_SUMMARY_FIELDS} } }
            }
        }`,
                {
                    id: viewId,
                    pagination: { limit, offset },
                    propertyKeys,
                    groupValue,
                    dateRange,
                },
            );
            const result = viewReadSchema.parse(data?.readView);
            const keys =
                propertyKeys ??
                (result.view.displayType === 'table' ? result.view.displayOptions.tablePropertyKeys : []);
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
