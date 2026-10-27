import { z } from 'zod';
import { QUERY_CONDITION_FIELDS, queryConditionsSchema } from './mcp-query-tools.js';

export const viewSchema = queryConditionsSchema.extend({
    defaultTemplateNoteId: z.string().nullable().optional(),
    id: z.string().describe('Saved view ID.'),
    groupId: z.string().describe('ID of the view group containing this view.'),
    title: z.string(),
    displayType: z.enum(['list', 'table', 'board', 'calendar']).describe('Display format for this view.'),
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

export const VIEW_FIELDS = `id groupId title defaultTemplateNoteId displayType limit order ${QUERY_CONDITION_FIELDS} displayOptions { tableColumns tablePropertyKeys boardGroupByPropertyKey calendarDateField calendarDatePropertyKey }`;
