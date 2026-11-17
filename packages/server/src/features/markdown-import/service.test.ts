import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '~/app.js';
import { createNoteQueryResolver } from '~/features/note/graphql/note.query.resolver.js';
import { subscribeNoteChanges } from '~/features/note/services/change-events.js';
import { createNotePropertyDefinition } from '~/features/note/services/properties.js';
import models from '~/models.js';
import { AUTH_SESSION_COOKIE_NAME } from '~/modules/auth-mode.js';
import { blocksToMarkdown } from '~/modules/blocknote.js';
import { createMarkdownImportService } from './service.js';

test('two-phase import persists aliases, backlinks, searchable text, properties, original dates and events', async () => {
    const service = createMarkdownImportService();
    const events: string[] = [];
    const unsubscribe = subscribeNoteChanges((event) => events.push(event.type));
    try {
        const session = await service.start({
            workspaceId: '1',
            mappings: [{ source: 'Score', mode: 'new', valueType: 'number' }],
        });
        const created = await service.create({
            token: session.token,
            notes: [
                {
                    path: 'a.md',
                    title: 'A',
                    createdAt: '2020-01-02T00:00:00.000Z',
                    updatedAt: '2021-03-04T12:00:00.000Z',
                },
                { path: 'b.md', title: 'B' },
            ],
        });
        const targetId = created.notes[1].id;
        const saved = await service.save({
            token: session.token,
            notes: [
                {
                    path: 'a.md',
                    markdown: `Chosen [[My alias]](note:${targetId}) [@imported]\n\n![pixel](/assets/images/test.png)`,
                    properties: { Score: '42' },
                },
                { path: 'b.md', markdown: 'Destination' },
            ],
        });

        assert.deepEqual(saved.errors, []);
        const note = await models.note.findUniqueOrThrow({
            where: { id: Number(created.notes[0].id) },
            include: { properties: { include: { definition: true } }, tags: true },
        });
        assert.equal(note.createdAt.toISOString(), '2020-01-02T00:00:00.000Z');
        assert.equal(note.updatedAt.toISOString(), '2021-03-04T12:00:00.000Z');
        assert.equal(note.properties[0].numberValue, 42);
        assert.equal(note.properties[0].definition.name, 'Score');
        assert.equal(note.tags[0].name, '@imported');
        assert.match(note.searchableText, /chosen/);
        assert.match(await blocksToMarkdown(note.content), /My alias \(\[\[B\]\]\(note:/);
        assert.equal(
            await models.noteReference.count({ where: { sourceNoteId: note.id, targetNoteId: Number(targetId) } }),
            1,
        );
        assert.deepEqual(events, ['note.created', 'note.created', 'note.updated', 'note.updated']);
        const reread = await createNoteQueryResolver()(null, { id: String(note.id) });
        assert.equal(reread.updatedAt.toISOString(), '2021-03-04T12:00:00.000Z');
        assert.match(reread.content, /My alias/);
    } finally {
        unsubscribe();
    }
});

test('import properties cannot reuse another workspace definition', async () => {
    const other = await models.workspace.create({ data: { name: 'Other' } });
    await createNotePropertyDefinition({ workspaceId: other.id, key: 'score', name: 'Score', valueType: 'number' });
    const service = createMarkdownImportService();

    await assert.rejects(
        service.start({ workspaceId: '1', mappings: [{ source: 'Score', mode: 'existing', key: 'score' }] }),
        /target workspace/,
    );
    const session = await service.start({
        workspaceId: '1',
        mappings: [{ source: 'Score', mode: 'new', valueType: 'number' }],
    });

    assert.notEqual(session.mappings[0].key, 'score');
    const definition = await models.propertyDefinition.findUniqueOrThrow({ where: { key: session.mappings[0].key } });
    assert.equal(definition.workspaceId, 1);
    assert.equal(definition.name, 'Score');
});

test('retrying phase one and phase two does not create duplicate notes', async () => {
    const service = createMarkdownImportService();
    const session = await service.start({ workspaceId: '1', mappings: [] });
    const createInput = { token: session.token, notes: [{ path: 'a.md', title: 'A' }] };
    await service.create(createInput);
    await service.create(createInput);
    await service.save({ token: session.token, notes: [{ path: 'a.md', markdown: 'Original' }] });
    await service.save({ token: session.token, notes: [{ path: 'a.md', markdown: 'Retry' }] });

    assert.equal(await models.note.count(), 1);
    assert.match((await models.note.findFirstOrThrow()).content, /Original/);
});

test('select properties preserve Korean and punctuation as labels with valid internal option values', async () => {
    const service = createMarkdownImportService();
    const session = await service.start({
        workspaceId: '1',
        mappings: [{ source: 'State', mode: 'new', valueType: 'select', options: ['검토 중', '$65.00'] }],
    });
    await service.create({ token: session.token, notes: [{ path: 'a.md', title: 'A' }] });

    const saved = await service.save({
        token: session.token,
        notes: [{ path: 'a.md', markdown: 'Body', properties: { State: '검토 중' } }],
    });

    assert.deepEqual(saved.errors, []);
    const property = await models.noteProperty.findFirstOrThrow({ include: { option: true } });
    assert.equal(property.option?.label, '검토 중');
    assert.match(property.option?.value ?? '', /^option-/);
});

test('trash all affects only notes created by this import', async () => {
    await models.note.create({ data: { title: 'Existing', content: '[]' } });
    const service = createMarkdownImportService();
    const session = await service.start({ workspaceId: '1', mappings: [] });
    await service.create({
        token: session.token,
        notes: [
            { path: 'a.md', title: 'Imported' },
            { path: '__index__', title: 'Contents' },
        ],
    });

    const result = await service.trash({ token: session.token });

    assert.equal(result.trashed, 2);
    assert.deepEqual(result.errors, []);
    assert.equal(await models.note.count(), 1);
    assert.equal((await models.note.findFirstOrThrow()).title, 'Existing');
    assert.equal(await models.deletedNote.count(), 2);
});

test('a property value that does not fit its destination is reported without blocking the note content', async () => {
    await createNotePropertyDefinition({
        workspaceId: 1,
        key: 'status',
        name: 'Status',
        valueType: 'select',
        options: [{ value: 'done', label: 'Done' }],
    });
    const service = createMarkdownImportService();
    const session = await service.start({
        workspaceId: '1',
        mappings: [
            { source: 'Score', mode: 'new', valueType: 'number' },
            { source: 'Status', mode: 'existing', key: 'status' },
            { source: 'Rating', mode: 'new', valueType: 'number' },
        ],
    });
    const created = await service.create({ token: session.token, notes: [{ path: 'a.md', title: 'A' }] });

    const result = await service.save({
        token: session.token,
        notes: [{ path: 'a.md', markdown: 'Body', properties: { Score: '42', Status: 'draft', Rating: 'high' } }],
    });

    assert.deepEqual(result.saved, ['a.md']);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(
        result.droppedProperties.map(({ path, property, value }) => ({ path, property, value })),
        [
            { path: 'a.md', property: 'Status', value: 'draft' },
            { path: 'a.md', property: 'Rating', value: 'high' },
        ],
    );
    assert.match(result.droppedProperties[0].message, /option/);
    assert.match(result.droppedProperties[1].message, /finite/);
    const note = await models.note.findUniqueOrThrow({
        where: { id: Number(created.notes[0].id) },
        include: { properties: { include: { definition: true } } },
    });
    assert.match(await blocksToMarkdown(note.content), /Body/);
    assert.deepEqual(
        note.properties.map((property) => [property.definition.name, property.numberValue]),
        [['Score', 42]],
    );
});

test('a second field mapped to the same property is reported while the note is saved', async () => {
    await createNotePropertyDefinition({ workspaceId: 1, key: 'status', name: 'Status', valueType: 'text' });
    const service = createMarkdownImportService();
    const session = await service.start({
        workspaceId: '1',
        mappings: [
            { source: 'Status', mode: 'existing', key: 'status' },
            { source: 'state', mode: 'existing', key: 'status' },
        ],
    });
    const created = await service.create({ token: session.token, notes: [{ path: 'a.md', title: 'A' }] });

    const result = await service.save({
        token: session.token,
        notes: [{ path: 'a.md', markdown: 'Body', properties: { Status: 'Done', state: 'Draft' } }],
    });

    assert.deepEqual(result.saved, ['a.md']);
    assert.deepEqual(
        result.droppedProperties.map(({ property, value }) => ({ property, value })),
        [{ property: 'state', value: 'Draft' }],
    );
    const properties = await models.noteProperty.findMany({ where: { noteId: Number(created.notes[0].id) } });
    assert.deepEqual(
        properties.map((property) => property.textValue),
        ['Done'],
    );
});

test('a note with more properties than one property update allows is saved with all of them', async () => {
    const names = Array.from({ length: 60 }, (_, index) => `Field ${index}`);
    const service = createMarkdownImportService();
    const session = await service.start({
        workspaceId: '1',
        mappings: names.map((source) => ({ source, mode: 'new', valueType: 'text' })),
    });
    const created = await service.create({ token: session.token, notes: [{ path: 'a.md', title: 'A' }] });

    const result = await service.save({
        token: session.token,
        notes: [
            { path: 'a.md', markdown: 'Body', properties: Object.fromEntries(names.map((name) => [name, 'value'])) },
        ],
    });

    assert.deepEqual(result.saved, ['a.md']);
    assert.deepEqual(result.errors, []);
    assert.equal(await models.noteProperty.count({ where: { noteId: Number(created.notes[0].id) } }), 60);
});

test('archived workspaces and files outside the import are rejected', async () => {
    const archived = await models.workspace.create({ data: { name: 'Archive', archivedAt: new Date() } });
    const service = createMarkdownImportService();
    const session = await service.start({ workspaceId: '1', mappings: [] });

    await assert.rejects(service.start({ workspaceId: archived.id, mappings: [] }), /Unarchive/);
    await assert.rejects(
        service.save({ token: session.token, notes: [{ path: 'unknown.md', markdown: 'Body' }] }),
        /does not belong/,
    );
    await assert.rejects(
        service.create({ token: session.token, notes: [{ path: 'bad.md', title: 'Bad', createdAt: 'invalid' }] }),
        /timestamp/,
    );
    assert.equal(await models.note.count(), 0);
});

test('import HTTP routes require a browser session', async (t) => {
    const app = createApp({
        mode: 'password',
        password: 'secret',
        sessionSecret: 'test-session-secret',
        cookieName: AUTH_SESSION_COOKIE_NAME,
        source: 'password',
    });
    t.after(() => app.close());

    const response = await app.inject({
        method: 'POST',
        url: '/api/markdown-import/start',
        payload: { workspaceId: '1', mappings: [] },
    });

    assert.equal(response.statusCode, 401);
});

test('an authenticated import requires the current CSRF token', async (t) => {
    const app = createApp({
        mode: 'password',
        password: 'secret',
        sessionSecret: 'test-session-secret',
        cookieName: AUTH_SESSION_COOKIE_NAME,
        source: 'password',
    });
    t.after(() => app.close());
    const status = await app.inject({ method: 'GET', url: '/api/auth/session' });
    const cookies = Object.fromEntries(status.cookies.map((cookie) => [cookie.name, cookie.value]));
    const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        cookies,
        headers: { 'x-xsrf-token': cookies['XSRF-TOKEN'] },
        payload: { password: 'secret' },
    });
    assert.equal(login.statusCode, 200);
    Object.assign(cookies, Object.fromEntries(login.cookies.map((cookie) => [cookie.name, cookie.value])));

    const rejected = await app.inject({
        method: 'POST',
        url: '/api/markdown-import/start',
        cookies,
        payload: { workspaceId: '1', mappings: [] },
    });
    const accepted = await app.inject({
        method: 'POST',
        url: '/api/markdown-import/start',
        cookies,
        headers: { 'x-xsrf-token': cookies['XSRF-TOKEN'] },
        payload: { workspaceId: '1', mappings: [] },
    });

    assert.equal(rejected.statusCode, 403);
    assert.equal(accepted.statusCode, 200);
});

test('import HTTP routes enforce the existing open-mode origin boundary and request limit', async (t) => {
    const app = createApp({ mode: 'open', cookieName: AUTH_SESSION_COOKIE_NAME, source: 'explicit-open' });
    t.after(() => app.close());

    const crossOrigin = await app.inject({
        method: 'POST',
        url: '/api/markdown-import/start',
        headers: { origin: 'https://other.example' },
        payload: { workspaceId: '1', mappings: [] },
    });
    const oversized = await app.inject({
        method: 'POST',
        url: '/api/markdown-import/create',
        payload: { content: 'a'.repeat(1024 * 1024) },
    });
    const valid = await app.inject({
        method: 'POST',
        url: '/api/markdown-import/start',
        payload: { workspaceId: '1', mappings: [] },
    });

    assert.equal(crossOrigin.statusCode, 403);
    assert.equal(oversized.statusCode, 413);
    assert.equal(valid.statusCode, 200);
    assert.equal(typeof valid.json().token, 'string');
});
