import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

interface IntentWriteToolNames {
    appendNoteMarkdown: string;
    patchNoteMarkdown: string;
    replaceNoteMarkdown: string;
    updateNoteMetadata: string;
}

type JsonRequest = <TResponse extends Record<string, unknown>>(
    serverUrl: string,
    token: string | undefined,
    pathName: string,
    body: Record<string, unknown>
) => Promise<TResponse>;


interface RegisterIntentWriteToolsInput {
    jsonRequest: JsonRequest;
    requireWriteToken: (token: string | undefined, toolName: string) => string;
    serverUrl: string;
    token?: string;
    tools: IntentWriteToolNames;
}

interface DirectWriteResult extends Record<string, unknown> {
    status?: string;
    reason?: string;
    proposed?: {
        changedLineCount?: number;
    };
}

const markdownPatchSelectorSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('exact_text'),
        text: z.string(),
        before: z.string().optional(),
        after: z.string().optional()
    }),
    z.object({
        type: z.literal('match_candidate'),
        text: z.string(),
        matchIndex: z.number().int().nonnegative(),
        lineStart: z.number().int().positive(),
        matchSha256: z.string(),
        surroundingHash: z.string(),
        positionHint: z.enum(['first', 'last']).optional()
    })
]);

const markdownPatchOperationSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('replace'),
        replacement: z.string()
    }),
    z.object({
        type: z.literal('insert_before'),
        insertion: z.string()
    }),
    z.object({
        type: z.literal('insert_after'),
        insertion: z.string()
    })
]);

const markdownAppendPlacementSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('end')
    }),
    z.object({
        type: z.literal('after_heading'),
        heading: z.string(),
        level: z.number().int().min(1).max(6).optional()
    })
]);

const markdownWritePolicySchema = z.object({
    allowNoop: z.boolean().optional(),
    preserveTags: z.union([z.boolean(), z.literal('warn')]).optional(),
    preserveReferences: z.union([z.boolean(), z.literal('warn')]).optional()
}).optional();

export const MCP_METADATA_PROPERTY_PATCH_LIMIT = 50;

const normalizeMetadataPropertyKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, '-');

export const metadataPropertyPatchSchema = z.object({
    set: z.array(z.object({
        key: z.string().min(1).describe('Property key from ocean_brain_list_properties.'),
        value: z.string().describe('String value: select option.value, date YYYY-MM-DD, boolean true/false, number finite string, url http(s).')
    })).max(MCP_METADATA_PROPERTY_PATCH_LIMIT).optional().describe('Set up to 50 property values. Keys must be unique.'),
    deleteKeys: z.array(z.string().min(1)).max(MCP_METADATA_PROPERTY_PATCH_LIMIT).optional()
        .describe('Remove up to 50 property values from this note. Keys must be unique and not also in set.')
}).superRefine((patch, context) => {
    if ((patch.set?.length ?? 0) === 0 && (patch.deleteKeys?.length ?? 0) === 0) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'properties must include set or deleteKeys.'
        });
        return;
    }

    const setKeys = new Set<string>();

    for (const item of patch.set ?? []) {
        const key = normalizeMetadataPropertyKey(item.key);

        if (setKeys.has(key)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `properties.set contains duplicate key ${key}.`
            });
        }

        setKeys.add(key);
    }

    const deleteKeys = new Set<string>();

    for (const rawKey of patch.deleteKeys ?? []) {
        const key = normalizeMetadataPropertyKey(rawKey);

        if (deleteKeys.has(key)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `properties.deleteKeys contains duplicate key ${key}.`
            });
        }

        if (setKeys.has(key)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `properties cannot set and delete ${key} in one request.`
            });
        }

        deleteKeys.add(key);
    }
}).optional();

export const registerIntentWriteTools = (
    server: McpServer,
    {
        jsonRequest,
        requireWriteToken,
        serverUrl,
        token,
        tools
    }: RegisterIntentWriteToolsInput
) => {
    server.tool(
        tools.patchNoteMarkdown,
        'Patch a specific part of a note, like finding text with `rg` and editing only that match. Use for localized edits: fix one sentence, replace one paragraph, insert before/after exact text, or edit one section. Do not use for whole-note rewrites; use ocean_brain_replace_note_markdown instead.',
        {
            id: z.string().describe('Note ID to patch'),
            expectedUpdatedAt: z.string().optional().describe('Expected note updatedAt from the read you based this edit on. Required unless baseMarkdownSha256 is provided.'),
            baseMarkdownSha256: z.string().optional().describe('SHA-256 of the current markdown. Optional alternative to expectedUpdatedAt.'),
            intent: z.string().describe('Human-readable reason for the patch.'),
            selector: markdownPatchSelectorSchema.describe('Exact text or previously returned match candidate.'),
            operation: markdownPatchOperationSchema.describe('replace, insert_before, or insert_after.'),
            policy: markdownWritePolicySchema
        },
        async ({ id, expectedUpdatedAt, baseMarkdownSha256, intent, selector, operation, policy }) => {
            const writeToken = requireWriteToken(token, tools.patchNoteMarkdown);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(baseMarkdownSha256 ? { baseMarkdownSha256 } : {}),
                intent,
                selector,
                operation,
                ...(policy ? { policy } : {})
            };
            const result = await jsonRequest<DirectWriteResult>(serverUrl, writeToken, '/api/mcp/notes/patch-markdown', payload);

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        tools.appendNoteMarkdown,
        'Append markdown without changing existing content, like `cat addition.md >> note.md`. Use for adding logs, status updates, meeting notes, or new sections at the end or after a heading. Do not use to modify or replace existing body content.',
        {
            id: z.string().describe('Note ID to append to'),
            expectedUpdatedAt: z.string().optional().describe('Expected note updatedAt from the read you based this edit on. Required unless baseMarkdownSha256 is provided.'),
            baseMarkdownSha256: z.string().optional().describe('SHA-256 of the current markdown. Optional alternative to expectedUpdatedAt.'),
            intent: z.string().describe('Human-readable reason for the append.'),
            insertion: z.string().describe('Markdown to append. Tags are body tokens such as [@tag] or [#tag].'),
            placement: markdownAppendPlacementSchema.optional().describe('Default is end. after_heading requires one unique matching heading.'),
            separator: z.enum(['\n\n', '\n']).optional().describe('Separator inserted around appended markdown. Defaults to a blank line.'),
            policy: markdownWritePolicySchema
        },
        async ({ id, expectedUpdatedAt, baseMarkdownSha256, intent, insertion, placement, separator, policy }) => {
            const writeToken = requireWriteToken(token, tools.appendNoteMarkdown);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(baseMarkdownSha256 ? { baseMarkdownSha256 } : {}),
                intent,
                insertion,
                ...(placement ? { placement } : {}),
                ...(separator ? { separator } : {}),
                ...(policy ? { policy } : {})
            };
            const result = await jsonRequest<DirectWriteResult>(serverUrl, writeToken, '/api/mcp/notes/append-markdown', payload);

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        tools.updateNoteMetadata,
        'Update note metadata only: title, layout, or properties. This does not edit the note body. For properties, call ocean_brain_list_properties first. Use existing property key and string value only; do not send valueType. select=option.value, date=YYYY-MM-DD, boolean=true/false, number=finite string, url=http(s). Use deleteKeys to remove values. Definitions are not created.',
        {
            id: z.string().describe('Note ID to update'),
            expectedUpdatedAt: z.string().describe('Expected note updatedAt from the read you based this metadata edit on. Required to prevent stale writes.'),
            title: z.string().optional().describe('New note title'),
            layout: z.enum(['narrow', 'wide', 'full']).optional().describe('New note layout'),
            properties: metadataPropertyPatchSchema.describe('Patch existing shared property values. Include set and/or deleteKeys; empty patches are rejected.')
        },
        async ({ id, expectedUpdatedAt, title, layout, properties }) => {
            const writeToken = requireWriteToken(token, tools.updateNoteMetadata);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(title !== undefined ? { title } : {}),
                ...(layout ? { layout } : {}),
                ...(properties ? { properties } : {})
            };
            const result = await jsonRequest<DirectWriteResult>(serverUrl, writeToken, '/api/mcp/notes/metadata', payload);

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.tool(
        tools.replaceNoteMarkdown,
        'Replace the entire note body, like overwriting a markdown file with `cat new.md > note.md`. Use when the user explicitly asks to rewrite, replace, regenerate, restructure, or overwrite the whole note. Do not use for localized edits such as fixing one sentence, changing one paragraph, or inserting under a heading; use ocean_brain_patch_note_markdown instead.',
        {
            id: z.string().describe('Note ID to replace'),
            expectedUpdatedAt: z.string().optional().describe('Expected note updatedAt from the read you based this edit on. Required unless baseMarkdownSha256 is provided.'),
            baseMarkdownSha256: z.string().optional().describe('SHA-256 of the current markdown. Optional alternative to expectedUpdatedAt.'),
            intent: z.string().describe('Human-readable reason for the full replace.'),
            replacement: z.string().describe('Complete replacement markdown body. Tags are body tokens such as [@tag] or [#tag].'),
            policy: markdownWritePolicySchema
        },
        async ({ id, expectedUpdatedAt, baseMarkdownSha256, intent, replacement, policy }) => {
            const writeToken = requireWriteToken(token, tools.replaceNoteMarkdown);
            const payload = {
                id,
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(baseMarkdownSha256 ? { baseMarkdownSha256 } : {}),
                intent,
                replacement,
                ...(policy ? { policy } : {})
            };
            const result = await jsonRequest<DirectWriteResult>(serverUrl, writeToken, '/api/mcp/notes/replace-markdown', payload);

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );
};
