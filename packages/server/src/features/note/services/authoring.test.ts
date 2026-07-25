import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteAuthoringService } from './authoring.js';

test('note authoring create converts markdown after placeholder replacement', async () => {
    const created: Array<{
        title: string;
        content: string;
        layout?: 'wide' | 'narrow' | 'full';
        tagIds?: string[];
    }> = [];
    const service = createNoteAuthoringService({
        createNote: async (input) => {
            created.push(input);
            return {
                id: 4,
                title: input.title,
                content: input.content,
                layout: input.layout ?? 'wide',
                createdAt: new Date('2026-03-31T00:00:00.000Z'),
                updatedAt: new Date('2026-03-31T00:00:00.000Z'),
            };
        },
        findPlaceholders: async () => [
            {
                template: 'today',
                replacement: '2026-03-31',
            },
        ],
        parseMarkdownToContentJson: async (markdown) =>
            markdown === 'Body for 2026-03-31'
                ? JSON.stringify([
                      {
                          type: 'paragraph',
                          content: [
                              {
                                  type: 'tag',
                                  props: {
                                      id: '5',
                                      tag: '@project',
                                  },
                              },
                          ],
                      },
                  ])
                : JSON.stringify([
                      {
                          type: 'paragraph',
                          markdown,
                      },
                  ]),
        extractTagIds: (contentJson) =>
            JSON.parse(contentJson)[0]?.content?.[0]?.props?.id ? [JSON.parse(contentJson)[0].content[0].props.id] : [],
    });

    const result = await service.createNote({
        title: 'Plan {%today%}',
        markdown: 'Body for {%today%}',
        layout: 'full',
    });

    assert.deepEqual(created[0], {
        title: 'Plan 2026-03-31',
        content: JSON.stringify([
            {
                type: 'paragraph',
                content: [
                    {
                        type: 'tag',
                        props: {
                            id: '5',
                            tag: '@project',
                        },
                    },
                ],
            },
        ]),
        layout: 'full',
        tagIds: ['5'],
    });
    assert.deepEqual(result, {
        id: '4',
        title: 'Plan 2026-03-31',
        layout: 'full',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
    });
});
