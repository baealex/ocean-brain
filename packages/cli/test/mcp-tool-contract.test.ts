import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { OCEAN_BRAIN_MCP_TOOLS } from '../src/mcp.js';
import {
    createMcpJsonToolResult,
    createMcpTextToolResult,
    noteLayoutSchema,
} from '../src/mcp-tool-support.js';

interface JsonSchema {
    additionalProperties?: boolean;
    anyOf?: JsonSchema[];
    const?: unknown;
    default?: unknown;
    enum?: unknown[];
    items?: JsonSchema;
    maximum?: number;
    maxItems?: number;
    minimum?: number;
    minItems?: number;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
}

const EXPECTED_TOOL_ORDER = [
    OCEAN_BRAIN_MCP_TOOLS.searchNotes,
    OCEAN_BRAIN_MCP_TOOLS.readNote,
    OCEAN_BRAIN_MCP_TOOLS.createNote,
    OCEAN_BRAIN_MCP_TOOLS.updateNote,
    OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown,
    OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown,
    OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata,
    OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown,
    OCEAN_BRAIN_MCP_TOOLS.listTags,
    OCEAN_BRAIN_MCP_TOOLS.listProperties,
    OCEAN_BRAIN_MCP_TOOLS.listNotesByTag,
    OCEAN_BRAIN_MCP_TOOLS.listNotesByTags,
    OCEAN_BRAIN_MCP_TOOLS.queryNotesByProperties,
    OCEAN_BRAIN_MCP_TOOLS.listRecentNotes,
    OCEAN_BRAIN_MCP_TOOLS.findNoteCleanupCandidates,
    OCEAN_BRAIN_MCP_TOOLS.createTag,
    OCEAN_BRAIN_MCP_TOOLS.deleteNote,
];

const EXPECTED_SCHEMA_KEYS: Record<string, string[]> = {
    [OCEAN_BRAIN_MCP_TOOLS.searchNotes]: ['limit', 'query'],
    [OCEAN_BRAIN_MCP_TOOLS.readNote]: ['id', 'maxLength'],
    [OCEAN_BRAIN_MCP_TOOLS.createNote]: ['layout', 'markdown', 'title'],
    [OCEAN_BRAIN_MCP_TOOLS.updateNote]: ['id', 'layout', 'markdown', 'title'],
    [OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown]: [
        'baseMarkdownSha256',
        'expectedUpdatedAt',
        'id',
        'intent',
        'operation',
        'policy',
        'selector',
    ],
    [OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown]: [
        'baseMarkdownSha256',
        'expectedUpdatedAt',
        'id',
        'insertion',
        'intent',
        'placement',
        'policy',
        'separator',
    ],
    [OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata]: [
        'expectedUpdatedAt',
        'id',
        'layout',
        'properties',
        'title',
    ],
    [OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown]: [
        'baseMarkdownSha256',
        'expectedUpdatedAt',
        'id',
        'intent',
        'policy',
        'replacement',
    ],
    [OCEAN_BRAIN_MCP_TOOLS.listTags]: [],
    [OCEAN_BRAIN_MCP_TOOLS.listProperties]: ['limit', 'offset', 'query'],
    [OCEAN_BRAIN_MCP_TOOLS.listNotesByTag]: ['limit', 'offset', 'tag'],
    [OCEAN_BRAIN_MCP_TOOLS.listNotesByTags]: ['limit', 'mode', 'offset', 'tags'],
    [OCEAN_BRAIN_MCP_TOOLS.queryNotesByProperties]: [
        'includeProperties',
        'limit',
        'mode',
        'offset',
        'propertyFilters',
        'propertyKeys',
        'sortBy',
        'sortOrder',
        'tagNames',
    ],
    [OCEAN_BRAIN_MCP_TOOLS.listRecentNotes]: ['limit'],
    [OCEAN_BRAIN_MCP_TOOLS.findNoteCleanupCandidates]: ['keywords', 'limit', 'offset'],
    [OCEAN_BRAIN_MCP_TOOLS.createTag]: ['name'],
    [OCEAN_BRAIN_MCP_TOOLS.deleteNote]: ['id'],
};

const EXPECTED_REQUIRED_FIELDS: Record<string, string[]> = {
    [OCEAN_BRAIN_MCP_TOOLS.searchNotes]: ['query'],
    [OCEAN_BRAIN_MCP_TOOLS.readNote]: ['id'],
    [OCEAN_BRAIN_MCP_TOOLS.createNote]: ['title'],
    [OCEAN_BRAIN_MCP_TOOLS.updateNote]: ['id'],
    [OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown]: ['id', 'intent', 'selector', 'operation'],
    [OCEAN_BRAIN_MCP_TOOLS.appendNoteMarkdown]: ['id', 'intent', 'insertion'],
    [OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata]: ['id', 'expectedUpdatedAt'],
    [OCEAN_BRAIN_MCP_TOOLS.replaceNoteMarkdown]: ['id', 'intent', 'replacement'],
    [OCEAN_BRAIN_MCP_TOOLS.listTags]: [],
    [OCEAN_BRAIN_MCP_TOOLS.listProperties]: [],
    [OCEAN_BRAIN_MCP_TOOLS.listNotesByTag]: ['tag'],
    [OCEAN_BRAIN_MCP_TOOLS.listNotesByTags]: ['tags'],
    [OCEAN_BRAIN_MCP_TOOLS.queryNotesByProperties]: ['propertyFilters'],
    [OCEAN_BRAIN_MCP_TOOLS.listRecentNotes]: [],
    [OCEAN_BRAIN_MCP_TOOLS.findNoteCleanupCandidates]: [],
    [OCEAN_BRAIN_MCP_TOOLS.createTag]: ['name'],
    [OCEAN_BRAIN_MCP_TOOLS.deleteNote]: ['id'],
};

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Ocean Brain MCP stdio contract', () => {
    test('exposes the existing tools and serialized input schemas', { timeout: 30_000 }, async () => {
        // Arrange
        const client = new Client({ name: 'mcp-contract-test', version: '0.0.0' });
        const transport = new StdioClientTransport({
            command: process.execPath,
            args: [
                '--import',
                'tsx',
                path.resolve(cliRoot, 'src/index.ts'),
                'mcp',
                '--token',
                'contract-token',
            ],
            cwd: cliRoot,
            stderr: 'pipe',
        });
        let stderrOutput = '';
        transport.stderr?.on('data', (chunk) => {
            stderrOutput += String(chunk);
        });

        try {
            // Act
            await client.connect(transport);
            const { tools } = await client.listTools();
            const schemas = new Map(
                tools.map((tool) => [tool.name, tool.inputSchema as JsonSchema]),
            );

            // Assert
            assert.deepEqual(tools.map((tool) => tool.name), EXPECTED_TOOL_ORDER);

            for (const tool of tools) {
                const schema = tool.inputSchema as JsonSchema;
                assert.ok(tool.description?.trim(), `${tool.name} should keep a description`);
                assert.equal(schema.type, 'object');
                assert.deepEqual(
                    Object.keys(schema.properties ?? {}).sort(),
                    EXPECTED_SCHEMA_KEYS[tool.name],
                    `${tool.name} input fields changed`,
                );
                assert.deepEqual(
                    [...(schema.required ?? [])].sort(),
                    [...EXPECTED_REQUIRED_FIELDS[tool.name]].sort(),
                    `${tool.name} required fields changed`,
                );
            }

            const property = (toolName: string, propertyName: string) => {
                const propertySchema = schemas.get(toolName)?.properties?.[propertyName];
                assert.ok(propertySchema, `${toolName}.${propertyName} should exist`);
                return propertySchema;
            };

            assert.equal(property(OCEAN_BRAIN_MCP_TOOLS.searchNotes, 'limit').default, 10);
            assert.equal(property(OCEAN_BRAIN_MCP_TOOLS.readNote, 'maxLength').default, 1000);
            assert.equal(property(OCEAN_BRAIN_MCP_TOOLS.createNote, 'markdown').default, '');
            assert.deepEqual(property(OCEAN_BRAIN_MCP_TOOLS.createNote, 'layout').enum, ['narrow', 'wide', 'full']);
            assert.deepEqual(property(OCEAN_BRAIN_MCP_TOOLS.updateNote, 'layout').enum, ['narrow', 'wide', 'full']);
            assert.deepEqual(property(OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata, 'layout').enum, ['narrow', 'wide', 'full']);
            assert.equal(property(OCEAN_BRAIN_MCP_TOOLS.listProperties, 'query').default, '');
            assert.equal(property(OCEAN_BRAIN_MCP_TOOLS.listProperties, 'limit').default, 50);
            assert.equal(property(OCEAN_BRAIN_MCP_TOOLS.listProperties, 'offset').default, 0);
            assert.equal(property(OCEAN_BRAIN_MCP_TOOLS.listNotesByTags, 'mode').default, 'and');
            assert.deepEqual(property(OCEAN_BRAIN_MCP_TOOLS.listNotesByTags, 'mode').enum, ['and', 'or']);
            assert.equal(property(OCEAN_BRAIN_MCP_TOOLS.listRecentNotes, 'limit').default, 10);
            assert.equal(
                property(OCEAN_BRAIN_MCP_TOOLS.findNoteCleanupCandidates, 'keywords').default,
                'temp tmp draft test wip',
            );

            const variant = (variants: JsonSchema[] | undefined, discriminator: string) => {
                const matchedVariant = variants?.find((item) => item.properties?.type?.const === discriminator);
                assert.ok(matchedVariant, `${discriminator} schema variant should exist`);
                return matchedVariant;
            };
            const selectorVariants = property(OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown, 'selector').anyOf;
            assert.deepEqual([...(variant(selectorVariants, 'exact_text').required ?? [])].sort(), ['text', 'type']);
            assert.deepEqual([...(variant(selectorVariants, 'match_candidate').required ?? [])].sort(), [
                'type',
                'text',
                'matchIndex',
                'lineStart',
                'matchSha256',
                'surroundingHash',
            ].sort());
            const operationVariants = property(OCEAN_BRAIN_MCP_TOOLS.patchNoteMarkdown, 'operation').anyOf;
            assert.deepEqual([...(variant(operationVariants, 'replace').required ?? [])].sort(), ['replacement', 'type']);
            assert.deepEqual([...(variant(operationVariants, 'insert_before').required ?? [])].sort(), ['insertion', 'type']);
            assert.deepEqual([...(variant(operationVariants, 'insert_after').required ?? [])].sort(), ['insertion', 'type']);

            const metadataProperties = property(OCEAN_BRAIN_MCP_TOOLS.updateNoteMetadata, 'properties');
            assert.equal(metadataProperties.properties?.set?.maxItems, 50);
            assert.equal(metadataProperties.properties?.deleteKeys?.maxItems, 50);
            assert.deepEqual(
                [...(metadataProperties.properties?.set?.items?.required ?? [])].sort(),
                ['key', 'value'],
            );

            const propertyFilters = property(OCEAN_BRAIN_MCP_TOOLS.queryNotesByProperties, 'propertyFilters');
            assert.equal(propertyFilters.minItems, 1);
            assert.equal(propertyFilters.maxItems, 10);
            assert.deepEqual(
                [...(propertyFilters.items?.required ?? [])].sort(),
                ['key', 'operator', 'valueType'],
            );
            assert.deepEqual(
                propertyFilters.items?.properties?.valueType?.enum,
                ['text', 'url', 'number', 'date', 'boolean', 'select'],
            );
            assert.deepEqual(
                propertyFilters.items?.properties?.operator?.enum,
                ['equals', 'before', 'after', 'exists', 'notExists'],
            );
        } catch (error) {
            if (!stderrOutput.trim()) {
                throw error;
            }

            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`${message}\nMCP stderr:\n${stderrOutput.trim()}`, { cause: error });
        } finally {
            await client.close();
        }
    });
});

describe('MCP tool result support', () => {
    test('keeps text and pretty JSON response envelopes unchanged', () => {
        assert.deepEqual(createMcpTextToolResult('plain text'), {
            content: [{ type: 'text', text: 'plain text' }],
        });
        assert.deepEqual(createMcpJsonToolResult({ ok: true, count: 2 }), {
            content: [{
                type: 'text',
                text: '{\n  "ok": true,\n  "count": 2\n}',
            }],
        });
    });

    test('shares the unchanged note layout values across write tools', () => {
        for (const layout of ['narrow', 'wide', 'full']) {
            assert.equal(noteLayoutSchema.safeParse(layout).success, true);
        }

        assert.equal(noteLayoutSchema.safeParse('compact').success, false);
    });
});
