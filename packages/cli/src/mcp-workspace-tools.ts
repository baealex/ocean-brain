import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpQueryRequest } from './mcp-query-tools.js';
import { createMcpJsonToolResult } from './mcp-tool-support.js';

export const workspaceIdSchema = z.string().regex(/^[1-9]\d*$/).refine((value) => Number(value) <= 2_147_483_647, 'Invalid workspace ID.');
export const workspaceScopeSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('all') }).strict(),
    z.object({ kind: z.literal('workspace'), workspaceId: workspaceIdSchema }).strict(),
]).describe('Omit for all workspaces, or explicitly select one workspace. Get IDs from list_workspaces or a note.');
export const resolvedScopeSchema = z.object({ kind: z.enum(['all', 'workspace']), workspaceId: z.string().nullable() });
export const RESOLVED_SCOPE_FIELDS = 'resolvedScope { kind workspaceId }';

export const registerWorkspaceTools = (server: McpServer, request: McpQueryRequest) => {
    const workspaceSchema = z.object({ id: z.string(), name: z.string(), archivedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string() });
    server.registerTool('ocean_brain_list_workspaces', {
        description: 'List workspaces and their stable IDs. Workspaces have independent fields and views; notes can still reference notes in other spaces. Archived spaces remain readable but must be unarchived before writing. This does not switch a browser or another request’s workspace.',
        inputSchema: {}, outputSchema: { workspaces: z.array(workspaceSchema) }, annotations: { readOnlyHint: true },
    }, async () => {
        const data = await request('query { workspaces { id name archivedAt createdAt updatedAt } }', {});
        return createMcpJsonToolResult({ workspaces: z.array(workspaceSchema).parse(data?.workspaces) });
    });
};
