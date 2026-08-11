import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { emitServerEvent, serializeServerEvent } from './server-events.js';
import { createServerEventsHandler } from './server-events-handler.js';

test('server events handler streams emitted events and unsubscribes when the request closes', async () => {
    const request = new EventEmitter() as EventEmitter & {
        session: { cookie: { expires: Date } };
    };
    request.session = {
        cookie: { expires: new Date(Date.now() + 60_000) },
    };
    const responseEmitter = new EventEmitter();
    const response = Object.assign(responseEmitter, {
        statusCode: 0,
        headers: new Map<string, string>(),
        writes: [] as string[],
        ended: false,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        setHeader(name: string, value: string) {
            this.headers.set(name, value);
            return this;
        },
        flushHeaders() {
            // The fake response records streamed body writes only.
        },
        write(chunk: string) {
            this.writes.push(chunk);
            return true;
        },
        end() {
            this.ended = true;
            responseEmitter.emit('close');
            return this;
        },
    });
    const handler = createServerEventsHandler();

    await handler(request as never, response as never, (() => undefined) as never);
    const streamedEvent = emitServerEvent({
        type: 'mcp.note.updated',
        source: 'mcp',
        noteId: '7',
        updatedAt: '2026-08-08T00:00:00.000Z',
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/event-stream; charset=utf-8');
    assert.deepEqual(response.writes, [': connected\n\n', serializeServerEvent(streamedEvent)]);

    request.emit('close');
    emitServerEvent({
        type: 'mcp.note.deleted',
        source: 'mcp',
        noteId: '7',
    });

    assert.deepEqual(response.writes, [': connected\n\n', serializeServerEvent(streamedEvent)]);
});
