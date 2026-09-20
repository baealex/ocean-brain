import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createIntegrationService } from '../src/features/integration/service.js';
import { updateNotePropertyDefinition } from '../src/features/note/services/properties.js';
import models from '../src/models.js';
import { AUTH_SESSION_COOKIE_NAME } from '../src/modules/auth-mode.js';

const openAuth = { mode: 'open', cookieName: AUTH_SESSION_COOKIE_NAME, source: 'explicit-open' } as const;
const manifest = {
    schemaVersion: 1,
    apiVersion: 1,
    id: 'example.note-sync',
    name: 'Note sync',
    version: '1.0.0',
    description: 'Indexes Ocean Brain notes.',
    permissions: ['notes:read'],
};

const createReadConnection = async () => {
    const service = createIntegrationService();
    const connection = await service.connect({ manifest, grantedPermissions: ['notes:read'] });
    await service.update(connection.id, { enabled: true });
    const credential = await service.rotateToken(connection.id);

    return { service, connectionId: connection.id, headers: { authorization: `Bearer ${credential.token}` } };
};

const readWithTimeout = async (reader: ReadableStreamDefaultReader<Uint8Array>, expected: string) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${expected}.`)), 3_000);
        }),
    ]).finally(() => clearTimeout(timeout));
};

const readUntil = async (reader: ReadableStreamDefaultReader<Uint8Array>, expected: string) => {
    const decoder = new TextDecoder();
    let received = '';

    while (!received.includes(expected)) {
        const result = await readWithTimeout(reader, expected);

        if (result.done) throw new Error(`Event stream ended before receiving ${expected}.`);
        received += decoder.decode(result.value, { stream: true });
    }

    return received;
};

test('note catalog supports lightweight keyset reconciliation', async (t) => {
    const app = createApp(openAuth, { logger: false });
    const { service, connectionId, headers } = await createReadConnection();
    t.after(async () => {
        await service.disconnect(connectionId);
        await app.close();
    });
    const first = await models.note.create({ data: { title: 'First catalog note', content: '' } });
    const second = await models.note.create({ data: { title: 'Second catalog note', content: '' } });

    const firstPage = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/notes/catalog',
        headers,
        payload: { limit: 1 },
    });
    const firstBody = firstPage.json();
    const secondPage = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/notes/catalog',
        headers,
        payload: { limit: 1, afterId: firstBody.nextAfterId },
    });

    assert.equal(firstPage.statusCode, 200);
    assert.deepEqual(firstBody.notes, [{ id: String(first.id), updatedAt: first.updatedAt.toISOString() }]);
    assert.match(firstBody.propertySchemaHash, /^[a-f0-9]{64}$/);
    assert.equal(firstBody.hasMore, true);
    assert.deepEqual(secondPage.json(), {
        notes: [{ id: String(second.id), updatedAt: second.updatedAt.toISOString() }],
        hasMore: false,
        nextAfterId: null,
    });
});

test('note catalog detects property schema changes that do not touch note timestamps', async (t) => {
    const app = createApp(openAuth, { logger: false });
    const { service, connectionId, headers } = await createReadConnection();
    t.after(async () => {
        await service.disconnect(connectionId);
        await app.close();
    });
    const note = await models.note.create({ data: { title: 'Property note', content: '' } });
    const definition = await models.propertyDefinition.create({
        data: { key: 'state', name: 'State', valueType: 'text' },
    });
    await models.noteProperty.create({
        data: {
            noteId: note.id,
            propertyDefinitionId: definition.id,
            textValue: 'active',
            textValueNormalized: 'active',
        },
    });
    const initial = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/notes/catalog',
        headers,
        payload: {},
    });

    await updateNotePropertyDefinition({ key: 'state', input: { name: 'Workflow state' } });
    const changed = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/notes/catalog',
        headers,
        payload: {},
    });
    const unchangedNote = await models.note.findUniqueOrThrow({ where: { id: note.id } });

    assert.notEqual(initial.json().propertySchemaHash, changed.json().propertySchemaHash);
    assert.equal(unchangedNote.updatedAt.getTime(), note.updatedAt.getTime());
});

test('integration event stream forwards native note changes without persisting them', async (t) => {
    const app = createApp(openAuth, { logger: false });
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    const { service, connectionId, headers } = await createReadConnection();
    const abortController = new AbortController();
    t.after(async () => {
        abortController.abort();
        await service.disconnect(connectionId);
        await app.close();
    });

    const response = await fetch(`${baseUrl}/api/integrations/v1/events`, {
        headers: { ...headers, accept: 'text/event-stream' },
        signal: abortController.signal,
    });
    assert.equal(response.status, 200);
    assert.ok(response.body);
    const reader = response.body.getReader();
    await readUntil(reader, ': connected');

    const created = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
            query: 'mutation { createNote(note: { title: "Streamed note", content: "" }) { id } }',
        },
    });
    const noteId = created.json().data.createNote.id;
    const streamed = await readUntil(reader, 'event: note.created');

    assert.equal(created.statusCode, 200);
    assert.match(streamed, new RegExp(`"noteId":"${noteId}"`));
    assert.doesNotMatch(streamed, /affectsSearchIndex/);
});

test('integration event stream closes when note read access is removed', async (t) => {
    const app = createApp(openAuth, { logger: false });
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    const { service, connectionId, headers } = await createReadConnection();
    const abortController = new AbortController();
    t.after(async () => {
        abortController.abort();
        await service.disconnect(connectionId);
        await app.close();
    });
    const response = await fetch(`${baseUrl}/api/integrations/v1/events`, {
        headers: { ...headers, accept: 'text/event-stream' },
        signal: abortController.signal,
    });
    assert.ok(response.body);
    const reader = response.body.getReader();
    await readUntil(reader, ': connected');

    await service.update(connectionId, { grantedPermissions: [] });
    const ended = await readWithTimeout(reader, 'the stream to close');

    assert.equal(ended.done, true);
});

test('integration note sync endpoints require notes read permission', async (t) => {
    const app = createApp(openAuth, { logger: false });
    t.after(() => app.close());

    const catalog = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/notes/catalog',
        payload: {},
    });
    const events = await app.inject({
        method: 'GET',
        url: '/api/integrations/v1/events',
    });

    assert.equal(catalog.statusCode, 401);
    assert.equal(events.statusCode, 401);
});
