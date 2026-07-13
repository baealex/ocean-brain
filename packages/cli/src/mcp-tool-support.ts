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

export const createMcpTextToolResult = (text: string) => ({
    content: [
        {
            type: 'text' as const,
            text,
        },
    ],
});

export const createMcpJsonToolResult = (value: unknown) => {
    return createMcpTextToolResult(JSON.stringify(value, null, 2));
};
