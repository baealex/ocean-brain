import assert from 'node:assert/strict';
import test from 'node:test';

import { createMcpAdminService } from '../src/modules/mcp-admin.js';

interface TokenRow {
    id: number;
    tokenHash: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
}

const createFakeDb = () => {
    const cacheStore = new Map<string, string>();
    const tokens: TokenRow[] = [];
    let nextId = 1;

    const fakeDb = {
        cache: {
            async findUnique({ where }: { where: { key: string } }) {
                const value = cacheStore.get(where.key);
                if (value === undefined) {
                    return null;
                }

                return {
                    key: where.key,
                    value,
                    id: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
            },
            async upsert({
                where,
                create,
                update,
            }: {
                where: { key: string };
                create: { key: string; value: string };
                update: { value: string };
            }) {
                const nextValue = cacheStore.has(where.key) ? update.value : create.value;
                cacheStore.set(where.key, nextValue);

                return {
                    id: 1,
                    key: where.key,
                    value: nextValue,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
            },
        },
        mcpToken: {
            async findFirst({
                where,
                orderBy,
            }: {
                where: { revokedAt: Date | null };
                orderBy: { createdAt: 'desc' | 'asc' };
            }) {
                const matches = tokens.filter((token) => token.revokedAt === where.revokedAt);
                matches.sort((left, right) => {
                    if (orderBy.createdAt === 'asc') {
                        return left.createdAt.getTime() - right.createdAt.getTime();
                    }

                    return right.createdAt.getTime() - left.createdAt.getTime();
                });

                return matches[0] ?? null;
            },
            async updateMany({ where, data }: { where: { revokedAt: Date | null }; data: { revokedAt: Date } }) {
                let count = 0;
                for (const token of tokens) {
                    if (token.revokedAt === where.revokedAt) {
                        token.revokedAt = data.revokedAt;
                        count += 1;
                    }
                }

                return { count };
            },
            async create({ data }: { data: { tokenHash: string } }) {
                const row: TokenRow = {
                    id: nextId,
                    tokenHash: data.tokenHash,
                    createdAt: new Date(),
                    lastUsedAt: null,
                    revokedAt: null,
                };
                nextId += 1;
                tokens.push(row);
                return row;
            },
            async update({ where, data }: { where: { id: number }; data: { lastUsedAt: Date } }) {
                const row = tokens.find((token) => token.id === where.id);
                if (!row) {
                    throw new Error(`Missing token row ${where.id}`);
                }
                row.lastUsedAt = data.lastUsedAt;
                return row;
            },
        },
        async $transaction<T>(callback: (tx: typeof fakeDb) => Promise<T>) {
            return callback(fakeDb);
        },
    };

    return { fakeDb, cacheStore, tokens };
};

test('defaults enabled=false when cache key is missing', async () => {
    const { fakeDb } = createFakeDb();
    const service = createMcpAdminService(fakeDb as never);

    const status = await service.getStatus();

    assert.equal(status.enabled, false);
    assert.equal(status.hasActiveToken, false);
    assert.equal(status.token, null);
});

test('setEnabled persists MCP_ENABLED through cache upsert', async () => {
    const { fakeDb, cacheStore } = createFakeDb();
    const service = createMcpAdminService(fakeDb as never);

    await service.setEnabled(true);
    const status = await service.getStatus();

    assert.equal(cacheStore.get('MCP_ENABLED'), 'true');
    assert.equal(status.enabled, true);
});

test('rotateToken revokes previous active token and returns new plaintext once', async () => {
    const { fakeDb, tokens } = createFakeDb();
    const service = createMcpAdminService(fakeDb as never);

    const first = await service.rotateToken();
    const second = await service.rotateToken();

    assert.ok(first.token.length > 0);
    assert.ok(second.token.length > 0);
    assert.notEqual(first.token, second.token);
    assert.equal(tokens.filter((token) => token.revokedAt === null).length, 1);
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].revokedAt instanceof Date, true);
});

test('validatePresentedToken accepts the active token and updates lastUsedAt', async () => {
    const { fakeDb, tokens } = createFakeDb();
    const service = createMcpAdminService(fakeDb as never);

    const rotated = await service.rotateToken();
    const accepted = await service.validatePresentedToken(rotated.token);
    const rejected = await service.validatePresentedToken('invalid-token');

    assert.deepEqual(accepted, { ok: true });
    assert.deepEqual(rejected, { ok: false, reason: 'forbidden' });
    assert.ok(tokens[0].lastUsedAt instanceof Date);
});
