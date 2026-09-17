import { z } from 'zod';

export type McpJsonRequest = <TResponse extends Record<string, unknown>>(
    serverUrl: string,
    token: string | undefined,
    pathName: string,
    body: Record<string, unknown>,
) => Promise<TResponse>;

export interface McpWriteToolRegistrationInput<TTools> {
    jsonRequest: McpJsonRequest;
    requireWriteToken: (token: string | undefined, toolName: string) => string;
    serverUrl: string;
    token?: string;
    tools: TTools;
}

export const noteLayoutSchema = z.enum(['narrow', 'wide', 'full']);

export const pageLimitSchema = (defaultLimit: number, maximum = 100) =>
    z.number().int().positive().default(defaultLimit).transform((value) => Math.min(value, maximum));

export const pageOffsetSchema = z.number().int().nonnegative().default(0);

export const createPageInfo = (totalCount: number, limit: number, offset: number) => ({
    limit,
    offset,
    hasMore: offset + limit < totalCount,
    nextOffset: offset + limit < totalCount ? offset + limit : null,
});

export const createMcpTextToolResult = (text: string) => ({
    content: [
        {
            type: 'text' as const,
            text,
        },
    ],
});

export const createMcpJsonToolResult = <T extends Record<string, unknown>>(value: T) => ({
    ...createMcpTextToolResult(JSON.stringify(value, null, 2)),
    structuredContent: value,
    ...(value.status === 'failed' || value.status === 'needs_disambiguation' ? { isError: true } : {}),
});
