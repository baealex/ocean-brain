import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTools } from '../src/mcp.js';

test('MCP workflows use one HTTP request, preserve backlinks and structured results, and reject invalid pages', async () => {
    const requests: Array<{
        path: string;
        body: { variables: Record<string, unknown>; properties?: unknown };
    }> = [];
    const note = {
        id: '17',
        title: 'Task',
        createdAt: '2026-09-17T00:00:00Z',
        updatedAt: '2026-09-17T01:00:00Z',
        tags: [],
        properties: [],
    };
    const conditions = {
        tagNames: [],
        mode: 'and',
        propertyFilters: [],
        sortBy: 'updatedAt',
        sortOrder: 'desc',
    };
    const section = {
        ...conditions,
        id: '3',
        tabId: '1',
        title: 'Tasks',
        displayType: 'board',
        limit: 5,
        order: 0,
        displayOptions: {
            tableColumns: ['title'],
            tablePropertyKeys: [],
            boardGroupByPropertyKey: 'state',
            calendarDateField: 'createdAt',
            calendarDatePropertyKey: null,
        },
    };
    let writeStatus = 'failed';
    const http = createServer(async (req, res) => {
        let text = '';
        for await (const chunk of req) text += chunk;
        const body = JSON.parse(text);
        requests.push({ path: req.url ?? '', body });
        let data: unknown;
        if (body.query?.includes('notesByQuery(')) {
            const names = body.variables.names.map((name: string) => (name.startsWith('@') ? name : `@${name}`));
            data = {
                notesByQuery: {
                    query: { ...body.variables.input, tagNames: names },
                    totalCount: 51,
                    notes: [note],
                },
                tagsByNames: names.filter((name: string) => name !== '@missing').map((name: string) => ({ name })),
            };
        } else if (body.query?.includes('noteRead(')) {
            data = {
                noteRead: {
                    status: 'read',
                    reason: null,
                    message: null,
                    note,
                    markdown: 'Requested tail',
                    candidates: [],
                    contentRange: {
                        start: 9000,
                        end: 9014,
                        totalLength: 9014,
                        sectionEnd: 9014,
                        hasMore: false,
                        nextOffset: null,
                    },
                },
                backReferences: [{ id: '2', title: 'Linked context' }],
            };
        } else if (body.query?.includes('viewSections(')) {
            data = {
                viewSections: {
                    totalCount: 1,
                    sections: [{ tabTitle: 'Project', section }],
                },
            };
        } else if (body.query?.includes('readViewSection(')) {
            data = {
                readViewSection: {
                    section,
                    totalCount: 1,
                    rows: [{ note, groupValue: null, calendarDate: null }],
                    groupProperty: { key: 'state', name: 'State', options: [] },
                },
            };
        }
        if (req.url === '/api/integrations/v1/notes/append-markdown') {
            res.setHeader('content-type', 'application/json');
            res.end(
                JSON.stringify({
                    status: writeStatus,
                    reason: writeStatus === 'failed' ? 'BASELINE_MISMATCH' : undefined,
                    warnings: ['Tag count decreased'],
                    matches: [{ lineStart: 3 }],
                }),
            );
            return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(
            JSON.stringify(
                req.url === '/api/integrations/v1/graphql'
                    ? { data }
                    : {
                          created: true,
                          note: { ...note, properties: body.properties.set },
                      },
            ),
        );
    });
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const address = http.address();
    assert.ok(address && typeof address !== 'string');
    const server = new McpServer({ name: 'workflows', version: '1' });
    const client = new Client({ name: 'workflows', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    registerMcpTools(server, `http://127.0.0.1:${address.port}`, 'fixture-token');
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        for (const tagNames of [[], ['project'], ['project', 'task', 'doing', 'team', 'missing']]) {
            const before = requests.length;
            const result = await client.callTool({
                name: 'ocean_brain_query_notes',
                arguments: { tagNames, limit: 999 },
            });
            assert.notEqual(result.isError, true);
            assert.equal(requests.length - before, 1);
            assert.deepEqual(result.structuredContent?.page, {
                limit: 50,
                offset: 0,
                hasMore: true,
                nextOffset: 50,
            });
            assert.deepEqual(result.structuredContent?.missingTags, tagNames.includes('missing') ? ['@missing'] : []);
            const content = result.content[0];
            assert.ok(content.type === 'text');
            assert.deepEqual(JSON.parse(content.text), result.structuredContent);
        }
        for (const args of [{ limit: 0 }, { limit: -1 }, { limit: 1.5 }, { offset: -1 }, { offset: 0.5 }]) {
            const before = requests.length;
            const result = await client.callTool({
                name: 'ocean_brain_query_notes',
                arguments: args,
            });
            assert.equal(result.isError, true);
            assert.equal(requests.length, before);
        }
        const read = await client.callTool({
            name: 'ocean_brain_read_note',
            arguments: {
                id: '17',
                offset: 9000,
                maxLength: 1000,
                expectedUpdatedAt: note.updatedAt,
            },
        });
        assert.equal(read.structuredContent?.markdown, 'Requested tail');
        assert.deepEqual(read.structuredContent?.backReferences, [{ id: '2', title: 'Linked context' }]);
        assert.equal(read.content[0].type === 'text' && read.content[0].text.includes('(note:2)'), true);
        assert.equal(
            (
                await client.callTool({
                    name: 'ocean_brain_read_note',
                    arguments: { id: '17', offset: 0, heading: 'Tasks' },
                })
            ).isError,
            true,
        );
        const list = await client.callTool({
            name: 'ocean_brain_list_views',
            arguments: {},
        });
        assert.notEqual(list.isError, true);
        const view = await client.callTool({
            name: 'ocean_brain_read_view',
            arguments: { sectionId: '3', groupValue: null },
        });
        assert.notEqual(view.isError, true);
        assert.equal(requests.at(-1)?.body.variables.groupValue, null);
        assert.deepEqual(view.structuredContent?.selection, {
            propertyKeys: [],
            groupValue: null,
        });
        for (const status of ['failed', 'needs_disambiguation', 'applied']) {
            writeStatus = status;
            const result = await client.callTool({
                name: 'ocean_brain_append_note_markdown',
                arguments: {
                    id: '17',
                    expectedUpdatedAt: note.updatedAt,
                    intent: 'Add detail',
                    insertion: 'Detail',
                },
            });
            assert.equal(result.isError === true, status !== 'applied');
            assert.equal(result.structuredContent?.status, status);
            assert.deepEqual(result.structuredContent?.warnings, ['Tag count decreased']);
            if (status === 'needs_disambiguation')
                assert.deepEqual(result.structuredContent?.matches, [{ lineStart: 3 }]);
        }
        const beforeCreate = requests.length;
        const created = await client.callTool({
            name: 'ocean_brain_create_note',
            arguments: {
                title: 'Task',
                properties: { set: [{ key: 'state', value: 'todo' }] },
            },
        });
        assert.notEqual(created.isError, true);
        assert.equal(requests.length - beforeCreate, 1);
        assert.equal(requests.at(-1)?.path, '/api/integrations/v1/notes/create');
        assert.deepEqual(requests.at(-1)?.body.properties, {
            set: [{ key: 'state', value: 'todo' }],
        });
    } finally {
        await client.close();
        await server.close();
        await new Promise<void>((resolve, reject) => http.close((error) => (error ? reject(error) : resolve())));
    }
});
