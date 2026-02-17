import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
);

interface BlockNote {
    id?: string;
    type: string;
    props?: Record<string, unknown>;
    content?: BlockNote[];
    children?: BlockNote[];
    text?: string;
}

function blockNoteToPlainText(blocks: BlockNote[]): string {
    const lines: string[] = [];
    let numberedIndex = 0;

    for (const block of blocks) {
        const inlineText = extractInlineText(block.content);

        switch (block.type) {
            case 'heading': {
                const level = (block.props?.level as number) || 1;
                lines.push('#'.repeat(level) + ' ' + inlineText);
                numberedIndex = 0;
                break;
            }
            case 'bulletListItem':
                lines.push('- ' + inlineText);
                numberedIndex = 0;
                break;
            case 'numberedListItem':
                numberedIndex++;
                lines.push(`${numberedIndex}. ` + inlineText);
                break;
            case 'paragraph':
                lines.push(inlineText);
                numberedIndex = 0;
                break;
            default:
                if (inlineText) {
                    lines.push(inlineText);
                }
                numberedIndex = 0;
                break;
        }

        if (block.children?.length) {
            const childText = blockNoteToPlainText(block.children);
            if (childText) {
                lines.push(childText);
            }
        }
    }

    return lines.join('\n');
}

function extractInlineText(content?: BlockNote[]): string {
    if (!content) return '';

    return content.map((inline) => {
        switch (inline.type) {
            case 'text':
                return inline.text || '';
            case 'reference':
                return `[[${inline.props?.title || inline.props?.id || ''}]]`;
            case 'tag':
                return `#${(inline.props?.tag as string)?.replace(/^@/, '') || inline.props?.name || ''}`;
            default:
                return inline.text || '';
        }
    }).join('');
}

async function graphql(serverUrl: string, query: string, variables?: Record<string, unknown>) {
    const response = await fetch(`${serverUrl}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };

    if (result.errors?.length) {
        throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    return result.data;
}

export async function startMcpServer(serverUrl: string) {
    const server = new McpServer({
        name: 'ocean-brain',
        version: pkg.version,
    });

    server.tool(
        'search_notes',
        'Search notes by keyword. Returns a list of matching notes with title and tags. Use read_note to get full content of a specific note.',
        {
            query: z.string().describe('Search keyword'),
            limit: z.number().optional().default(10).describe('Max results (default: 10)'),
        },
        async ({ query, limit }) => {
            const data = await graphql(serverUrl, `
                query ($searchFilter: SearchFilterInput, $pagination: PaginationInput) {
                    allNotes(searchFilter: $searchFilter, pagination: $pagination) {
                        totalCount
                        notes {
                            id
                            title
                            updatedAt
                            tags { id name }
                            content
                        }
                    }
                }
            `, {
                searchFilter: { query, sortBy: 'updatedAt', sortOrder: 'desc' },
                pagination: { limit, offset: 0 },
            });

            const result = data?.allNotes as {
                totalCount: number;
                notes: Array<{
                    id: string;
                    title: string;
                    updatedAt: string;
                    tags: Array<{ id: string; name: string }>;
                    content: string;
                }>;
            };

            const notes = result.notes.map((note) => {
                let preview = '';
                try {
                    const blocks = JSON.parse(note.content);
                    preview = blockNoteToPlainText(blocks).slice(0, 100);
                } catch {
                    preview = '';
                }

                return {
                    id: note.id,
                    title: note.title,
                    updatedAt: note.updatedAt,
                    tags: note.tags.map((t) => t.name),
                    preview,
                };
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({ totalCount: result.totalCount, notes }, null, 2),
                }],
            };
        },
    );

    server.tool(
        'read_note',
        'Read content of a note by ID. Returns truncated by default (1000 chars). Set maxLength to 0 for full content only when necessary.',
        {
            id: z.string().describe('Note ID'),
            maxLength: z.number().optional().default(1000).describe('Max content length in characters. 0 for full content. (default: 1000)'),
        },
        async ({ id, maxLength }) => {
            const data = await graphql(serverUrl, `
                query ($id: ID!) {
                    note(id: $id) {
                        id
                        title
                        content
                        createdAt
                        updatedAt
                        tags { id name }
                    }
                }
            `, { id });

            const note = data?.note as {
                id: string;
                title: string;
                content: string;
                createdAt: string;
                updatedAt: string;
                tags: Array<{ id: string; name: string }>;
            };

            let plainText = '';
            try {
                const blocks = JSON.parse(note.content);
                plainText = blockNoteToPlainText(blocks);
            } catch {
                plainText = note.content;
            }

            const totalLength = plainText.length;
            let truncated = false;
            if (maxLength > 0 && plainText.length > maxLength) {
                plainText = plainText.slice(0, maxLength);
                truncated = true;
            }

            const output = [
                `# ${note.title}`,
                '',
                `Tags: ${note.tags.map((t) => t.name).join(', ') || '(none)'}`,
                `Created: ${note.createdAt}`,
                `Updated: ${note.updatedAt}`,
                ...(truncated ? [`Content: ${totalLength} chars (showing first ${maxLength})`] : []),
                '',
                plainText,
                ...(truncated ? ['\n... (truncated, use maxLength: 0 to read full content)'] : []),
            ].join('\n');

            return {
                content: [{
                    type: 'text' as const,
                    text: output,
                }],
            };
        },
    );

    server.tool(
        'list_tags',
        'List all tags with their note counts.',
        {},
        async () => {
            const data = await graphql(serverUrl, `
                query ($searchFilter: SearchFilterInput, $pagination: PaginationInput) {
                    allTags(searchFilter: $searchFilter, pagination: $pagination) {
                        totalCount
                        tags {
                            id
                            name
                            referenceCount
                        }
                    }
                }
            `, {
                searchFilter: { query: '' },
                pagination: { limit: 100, offset: 0 },
            });

            const result = data?.allTags as {
                totalCount: number;
                tags: Array<{ id: string; name: string; referenceCount: number }>;
            };

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2),
                }],
            };
        },
    );

    server.tool(
        'list_recent_notes',
        'List recently updated notes. Returns titles and tags only. Use read_note to get content of a specific note.',
        {
            limit: z.number().optional().default(10).describe('Max results (default: 10)'),
        },
        async ({ limit }) => {
            const data = await graphql(serverUrl, `
                query ($searchFilter: SearchFilterInput, $pagination: PaginationInput) {
                    allNotes(searchFilter: $searchFilter, pagination: $pagination) {
                        totalCount
                        notes {
                            id
                            title
                            updatedAt
                            tags { id name }
                        }
                    }
                }
            `, {
                searchFilter: { query: '', sortBy: 'updatedAt', sortOrder: 'desc' },
                pagination: { limit, offset: 0 },
            });

            const result = data?.allNotes as {
                totalCount: number;
                notes: Array<{
                    id: string;
                    title: string;
                    updatedAt: string;
                    tags: Array<{ id: string; name: string }>;
                }>;
            };

            const notes = result.notes.map((note) => ({
                id: note.id,
                title: note.title,
                updatedAt: note.updatedAt,
                tags: note.tags.map((t) => t.name),
            }));

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({ totalCount: result.totalCount, notes }, null, 2),
                }],
            };
        },
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
