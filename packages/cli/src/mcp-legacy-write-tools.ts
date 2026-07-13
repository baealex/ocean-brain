import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
    createMcpJsonToolResult,
    type McpWriteToolRegistrationInput,
    noteLayoutSchema,
} from './mcp-tool-support.js';

interface LegacyWriteToolNames {
    updateNote: string;
}

export const LEGACY_UPDATE_NOTE_DESCRIPTION =
    'Legacy full-field note update kept for backward compatibility. Prefer ocean_brain_patch_note_markdown for localized body edits, ocean_brain_append_note_markdown for additions, ocean_brain_replace_note_markdown for whole-body rewrites, and ocean_brain_update_note_metadata for title/layout/properties. Use this only when a legacy client needs combined field updates.';

export const registerLegacyWriteTools = (
    server: McpServer,
    { jsonRequest, requireWriteToken, serverUrl, token, tools }: McpWriteToolRegistrationInput<LegacyWriteToolNames>,
) => {
    server.tool(
        tools.updateNote,
        LEGACY_UPDATE_NOTE_DESCRIPTION,
        {
            id: z.string().describe('Note ID to update'),
            title: z.string().optional().describe('New note title'),
            markdown: z
                .string()
                .optional()
                .describe('Replacement markdown body. In MCP markdown, tags must use [@tag] or [#tag].'),
            layout: noteLayoutSchema
                .optional()
                .describe('Optional note layout: narrow, wide, or full. Prefer wide for most notes unless the user explicitly wants narrow or full.'),
        },
        async ({ id, title, markdown, layout }) => {
            const writeToken = requireWriteToken(token, tools.updateNote);
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
                ...(layout ? { layout } : {}),
            });

            return createMcpJsonToolResult(result);
        },
    );
};
