import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';

import {
    createMcpWriteSafetyCoordinator,
    formatMcpGraphqlError,
    McpCliWriteSafetyError,
    resolveCliMcpWriteIntent
} from '../src/mcp-write-safety.js';

const createTempRootDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-mcp-write-safety-'));

test('resolveCliMcpWriteIntent defaults destructive actions to dry-run mode', () => {
    assert.deepEqual(resolveCliMcpWriteIntent({}), { mode: 'dry-run' });
});

test('resolveCliMcpWriteIntent rejects commit mode without operation metadata', () => {
    assert.throws(
        () => resolveCliMcpWriteIntent({ dryRun: false }),
        (error: unknown) => {
            assert.ok(error instanceof McpCliWriteSafetyError);
            assert.equal(error.code, 'CONFIRMATION_REQUIRED');
            return true;
        }
    );
});

test('formatMcpGraphqlError includes operation metadata when present', () => {
    assert.equal(
        formatMcpGraphqlError({
            message: 'MCP endpoint is read-only',
            extensions: {
                code: 'FORBIDDEN',
                operationId: 'op-123'
            }
        }),
        'GraphQL error: MCP endpoint is read-only (code=FORBIDDEN, operationId=op-123)'
    );
});

test('ensureDestructiveWriteRequest returns a dry-run proposal and persists a pending operation', () => {
    const rootDir = createTempRootDir();
    const coordinator = createMcpWriteSafetyCoordinator({
        rootDir,
        now: () => new Date('2026-03-30T12:00:00.000Z'),
        randomBytes: (size) => Buffer.alloc(size, 1)
    });

    const result = coordinator.ensureDestructiveWriteRequest(
        { dryRun: true },
        {
            actor: 'test-actor',
            affectedIds: ['1', '2'],
            estimatedChangeCount: 2,
            risk: 'destructive',
            summary: 'Delete two notes',
            toolName: 'delete_notes'
        }
    );

    assert.equal(result.kind, 'dry-run');
    assert.equal(result.operation.operationId, 'mcpw_0101010101010101');
    assert.equal(result.operation.confirmToken, 'confirm_010101010101010101010101');
    assert.equal(coordinator.getStatus().pendingOperationCount, 1);
    assert.ok(fs.existsSync(path.join(rootDir, 'operations.jsonl')));
});

test('ensureDestructiveWriteRequest rejects destructive writes without a confirmation after dry-run', () => {
    const coordinator = createMcpWriteSafetyCoordinator({ rootDir: createTempRootDir() });

    assert.throws(
        () => coordinator.ensureDestructiveWriteRequest(
            { dryRun: false },
            {
                actor: 'test-actor',
                affectedIds: ['1'],
                estimatedChangeCount: 1,
                risk: 'destructive',
                summary: 'Delete one note',
                toolName: 'delete_note'
            }
        ),
        (error: unknown) => {
            assert.ok(error instanceof McpCliWriteSafetyError);
            assert.equal(error.code, 'CONFIRMATION_REQUIRED');
            return true;
        }
    );
});

test('ensureDestructiveWriteRequest consumes a matching confirmation and removes it from pending operations', () => {
    const rootDir = createTempRootDir();
    const coordinator = createMcpWriteSafetyCoordinator({
        rootDir,
        now: () => new Date('2026-03-30T12:00:00.000Z'),
        randomBytes: (size) => Buffer.alloc(size, 2)
    });

    const prepared = coordinator.prepareOperation({
        actor: 'test-actor',
        affectedIds: ['9'],
        estimatedChangeCount: 1,
        risk: 'destructive',
        summary: 'Delete note 9',
        toolName: 'delete_note'
    });

    const confirmed = coordinator.ensureDestructiveWriteRequest(
        {
            dryRun: false,
            operationId: prepared.operationId,
            confirmToken: prepared.confirmToken
        },
        {
            actor: 'test-actor',
            affectedIds: ['9'],
            estimatedChangeCount: 1,
            risk: 'destructive',
            summary: 'Delete note 9',
            toolName: 'delete_note'
        }
    );

    assert.equal(confirmed.kind, 'confirmed');
    assert.equal(confirmed.operation.operationId, prepared.operationId);
    assert.equal(coordinator.getStatus().pendingOperationCount, 0);
});

test('ensureDestructiveWriteRequest rejects invalid confirmation tokens', () => {
    const coordinator = createMcpWriteSafetyCoordinator({
        rootDir: createTempRootDir(),
        now: () => new Date('2026-03-30T12:00:00.000Z'),
        randomBytes: (size) => Buffer.alloc(size, 3)
    });

    const prepared = coordinator.prepareOperation({
        actor: 'test-actor',
        affectedIds: ['7'],
        estimatedChangeCount: 1,
        risk: 'destructive',
        summary: 'Delete note 7',
        toolName: 'delete_note'
    });

    assert.throws(
        () => coordinator.requireConfirmedOperation(
            {
                dryRun: false,
                operationId: prepared.operationId,
                confirmToken: 'confirm_wrong'
            },
            { toolName: 'delete_note' }
        ),
        (error: unknown) => {
            assert.ok(error instanceof McpCliWriteSafetyError);
            assert.equal(error.code, 'INVALID_CONFIRMATION');
            return true;
        }
    );
});

test('expired pending confirmations are cleaned up and reported as expired', () => {
    let currentTime = new Date('2026-03-30T12:00:00.000Z');
    const coordinator = createMcpWriteSafetyCoordinator({
        rootDir: createTempRootDir(),
        now: () => currentTime,
        randomBytes: (size) => Buffer.alloc(size, 4),
        ttlMs: 1_000
    });

    const prepared = coordinator.prepareOperation({
        actor: 'test-actor',
        affectedIds: ['11'],
        estimatedChangeCount: 1,
        risk: 'destructive',
        summary: 'Delete note 11',
        toolName: 'delete_note'
    });

    currentTime = new Date('2026-03-30T12:00:02.000Z');

    assert.throws(
        () => coordinator.requireConfirmedOperation(
            {
                dryRun: false,
                operationId: prepared.operationId,
                confirmToken: prepared.confirmToken
            },
            { toolName: 'delete_note' }
        ),
        (error: unknown) => {
            assert.ok(error instanceof McpCliWriteSafetyError);
            assert.equal(error.code, 'CONFIRMATION_EXPIRED');
            return true;
        }
    );

    const logLines = fs.readFileSync(path.join(coordinator.getStatus().rootDir, 'operations.jsonl'), 'utf-8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { phase: string });

    assert.equal(logLines.at(-1)?.phase, 'expired');
    assert.equal(coordinator.getStatus().pendingOperationCount, 0);
});

test('recordWriteResult appends execution results to the operation log', () => {
    const rootDir = createTempRootDir();
    const coordinator = createMcpWriteSafetyCoordinator({
        rootDir,
        now: () => new Date('2026-03-30T12:00:00.000Z'),
        randomBytes: (size) => Buffer.alloc(size, 5)
    });

    const prepared = coordinator.prepareOperation({
        actor: 'test-actor',
        affectedIds: ['12'],
        estimatedChangeCount: 1,
        risk: 'destructive',
        summary: 'Delete note 12',
        toolName: 'delete_note'
    });

    const confirmed = coordinator.requireConfirmedOperation(
        {
            dryRun: false,
            operationId: prepared.operationId,
            confirmToken: prepared.confirmToken
        },
        { toolName: 'delete_note' }
    );

    coordinator.recordWriteResult(confirmed, true);

    const logLines = fs.readFileSync(path.join(rootDir, 'operations.jsonl'), 'utf-8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { phase: string });

    assert.deepEqual(logLines.map((line) => line.phase), ['prepared', 'confirmed', 'executed']);
});
