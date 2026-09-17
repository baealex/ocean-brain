import assert from 'node:assert/strict';
import test from 'node:test';
import models from '~/models.js';
import { createNoteAuthoringService, createNoteFromMarkdown } from './authoring.js';
import { setNotePropertyValues } from './properties.js';

test('creation stores existing properties atomically and rejects invalid options before creating notes', async () => {
    await models.propertyDefinition.create({
        data: {
            key: 'create-state',
            name: 'State',
            valueType: 'select',
            options: { create: { label: 'Todo', value: 'todo', order: 0 } },
        },
    });
    const note = await createNoteFromMarkdown({
        title: 'Task',
        markdown: 'Body',
        properties: { set: [{ key: 'create-state', value: 'todo' }] },
    });
    assert.equal(note.properties?.[0].value, 'todo');
    assert.equal((await models.noteProperty.findMany({ where: { noteId: Number(note.id) } })).length, 1);
    const count = await models.note.count();
    await assert.rejects(
        createNoteFromMarkdown({
            title: 'Invalid',
            markdown: '[@must-not-be-created]',
            properties: { set: [{ key: 'create-state', value: 'missing' }] },
        }),
        /option/,
    );
    assert.equal(await models.note.count(), count);
    assert.equal(await models.tag.count({ where: { name: '@must-not-be-created' } }), 0);
    // If a definition changes between prevalidation and persistence, the note transaction rolls back.
    await assert.rejects(
        models.$transaction(async (tx) => {
            const created = await tx.note.create({ data: { title: 'Rolled back', content: '[]' } });
            await setNotePropertyValues(tx, created.id, {
                set: [{ key: 'create-state', valueType: 'select', value: 'removed-option' }],
            });
        }),
        /option/,
    );
    assert.equal(await models.note.count(), count);
});

test('note authoring create converts markdown after placeholder replacement', async () => {
    const created: Array<{
        title: string;
        content: string;
        layout?: 'wide' | 'narrow' | 'full';
        tagIds?: string[];
    }> = [];
    const service = createNoteAuthoringService({
        validateProperties: async () => {
            throw new Error('No properties in fixture');
        },
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
