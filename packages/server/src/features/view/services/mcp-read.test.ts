import assert from 'node:assert/strict';
import test from 'node:test';
import models from '~/models.js';
import { listViews, readView } from './mcp-read.js';
import {
    createView,
    createViewGroup,
    getNotesByProperties,
    getNotesByQuery,
    getViewBoardColumn,
    getViewCalendarNotes,
    getViewNotes,
} from './workspace.js';

test('MCP query and saved views preserve app note sets, pagination and active group', async () => {
    const tag = await models.tag.create({ data: { name: '@mcp-views' } });
    const state = await models.propertyDefinition.create({
        data: {
            key: 'mcp-state',
            name: 'State',
            valueType: 'select',
            options: { create: [{ label: 'Doing', value: 'doing', order: 0 }] },
        },
        include: { options: true },
    });
    const date = await models.propertyDefinition.create({ data: { key: 'mcp-date', name: 'Date', valueType: 'date' } });
    const notes = [];
    for (let i = 0; i < 4; i++) {
        notes.push(
            await models.note.create({
                data: {
                    title: `MCP ${i}`,
                    content: '[]',
                    tags: { connect: { id: tag.id } },
                    properties: {
                        create: [
                            {
                                propertyDefinitionId: date.id,
                                dateValue: new Date(`2026-09-${String(17 + i).padStart(2, '0')}T00:00:00Z`),
                            },
                            ...(i === 0 ? [{ propertyDefinitionId: state.id, optionId: state.options[0].id }] : []),
                        ],
                    },
                },
            }),
        );
    }
    const group = await createViewGroup('MCP fixtures');
    const before = await models.viewWorkspace.findUnique({ where: { id: 1 } });
    for (const displayType of ['list', 'table', 'board', 'calendar'] as const) {
        const view = await createView(group.id, {
            title: 'Same title',
            displayType,
            tagNames: [tag.name],
            sortBy: 'title',
            sortOrder: 'asc',
            displayOptions: {
                boardGroupByPropertyKey: state.key,
                calendarDateField: 'property',
                calendarDatePropertyKey: date.key,
            },
        });
        assert.ok(view);
        const dateRange = { start: '2026-09-17', end: '2026-09-20' };
        const result = await readView({
            id: view.id,
            pagination: { limit: 1, offset: 1 },
            ...(displayType === 'calendar' ? { dateRange } : {}),
        });
        const app =
            displayType === 'calendar'
                ? await getViewCalendarNotes(view.id, dateRange)
                : (await getViewNotes(view.id, { limit: 50, offset: 0 }))?.notes;
        assert.equal(result.totalCount, app?.length);
        assert.deepEqual(
            result.rows.map((row) => row.note.id),
            app?.slice(1, 2).map((note) => note.id),
        );
        if (displayType === 'board') {
            const unclassified = await readView({ id: view.id, groupValue: null });
            const appColumn = await getViewBoardColumn(view.id, null, { limit: 50 });
            assert.deepEqual(
                unclassified.rows.map((row) => row.note.id),
                appColumn?.notes.map((note) => note.id),
            );
            const classified = await readView({ id: view.id, groupValue: 'Doing' });
            assert.deepEqual(
                classified.rows.map((row) => row.note.id),
                [notes[0].id],
            );
        }
        if (displayType === 'calendar') {
            await assert.rejects(readView({ id: view.id }), /require dateRange/);
            await assert.rejects(
                readView({ id: view.id, dateRange: { start: '2026-01-01', end: '2026-03-01' } }),
                /32 days/,
            );
        }
    }
    const found = await listViews('MCP fixtures');
    assert.equal(found.totalCount, 4);
    assert.equal(new Set(found.views.map((view) => view.view.id)).size, 4);
    assert.equal((await models.viewWorkspace.findUnique({ where: { id: 1 } }))?.activeGroupId, before?.activeGroupId);
    assert.equal((await listViews('no-such-view')).totalCount, 0);
    await assert.rejects(readView({ id: '99999999' }), /not found/);
    const query = {
        tagNames: [tag.name],
        propertyFilters: [{ key: state.key, valueType: 'select' as const, operator: 'notExists' as const }],
    };
    assert.deepEqual(
        (await getNotesByQuery(query)).notes.map((note) => note.id),
        (await getNotesByProperties(query)).notes.map((note) => note.id),
    );
    assert.equal((await getNotesByQuery({ tagNames: [tag.name] })).totalCount, 4);
    assert.ok((await getNotesByQuery({})).totalCount >= 4);
    await assert.rejects(getNotesByProperties({}), /At least one/);
});
