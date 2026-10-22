import { createHash } from 'node:crypto';
import models, { type Prisma } from '~/models.js';
import { createAppError } from '~/modules/error-handler.js';

export const NAVIGATION_SETTINGS_KEY = 'UI_NAVIGATION';

interface NavigationPreferences extends Record<string, unknown> {
    schemaVersion: 1;
    order: string[];
    hiddenCoreIds: string[];
}

type NavigationDatabase = Pick<Prisma.TransactionClient, 'cache' | 'integrationConnection'>;

const invalidInput = (message: string) => createAppError(400, 'INVALID_NAVIGATION_SETTINGS', message);
const conflict = () =>
    createAppError(409, 'NAVIGATION_SETTINGS_CHANGED', 'Menu settings changed. Reload the settings before saving.');
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const parseIds = (value: unknown, coreOnly = false): string[] => {
    if (!Array.isArray(value) || value.length > 1_000 || new Set(value).size !== value.length) {
        throw invalidInput('Menu IDs must be unique, supported identifiers.');
    }
    return value.map((id: unknown) => {
        if (
            typeof id !== 'string' ||
            id.length > 200 ||
            !(coreOnly ? /^core:[\w.-]+$/ : /^(core|integration):[\w.-]+$/).test(id)
        ) {
            throw invalidInput('Menu IDs must be unique, supported identifiers.');
        }
        return id;
    });
};

const parsePins = (value: unknown) => {
    if (!Array.isArray(value) || value.length > 1_000) throw invalidInput('App visibility changes must be a list.');
    const pins = value.map((pin: unknown) => {
        if (
            !isRecord(pin) ||
            typeof pin.id !== 'string' ||
            typeof pin.pinned !== 'boolean' ||
            typeof pin.expectedUpdatedAt !== 'string' ||
            !Number.isFinite(Date.parse(pin.expectedUpdatedAt))
        ) {
            throw invalidInput('App visibility changes require a connection ID, visibility and update time.');
        }
        return { id: pin.id, pinned: pin.pinned, expectedUpdatedAt: pin.expectedUpdatedAt };
    });
    if (new Set(pins.map((pin) => pin.id)).size !== pins.length)
        throw invalidInput('App connection IDs must be unique.');
    return pins;
};

const parsePreferences = (value: unknown): NavigationPreferences => {
    if (!isRecord(value) || value.schemaVersion !== 1) throw invalidInput('Unsupported menu settings format.');
    return {
        ...value,
        schemaVersion: 1,
        order: parseIds(value.order ?? []),
        hiddenCoreIds: parseIds(value.hiddenCoreIds ?? [], true).filter((id) => id !== 'core:settings'),
    };
};

const getSnapshot = async (db: NavigationDatabase) => {
    const row = await db.cache.findUnique({ where: { key: NAVIGATION_SETTINGS_KEY } });
    const revision = row ? createHash('sha256').update(row.value).digest('hex') : null;
    if (!row) return { preferences: null, revision, status: 'ready' as const };
    try {
        const value: unknown = JSON.parse(row.value);
        if (isRecord(value) && typeof value.schemaVersion === 'number' && value.schemaVersion > 1) {
            return { preferences: null, revision, status: 'unsupported' as const };
        }
        return { preferences: parsePreferences(value), revision, status: 'ready' as const };
    } catch {
        return { preferences: null, revision, status: 'invalid' as const };
    }
};

export const createNavigationService = () => ({
    get: () => getSnapshot(models),
    async save(input: unknown) {
        if (
            !isRecord(input) ||
            !('expectedRevision' in input) ||
            !(input.expectedRevision === null || typeof input.expectedRevision === 'string')
        ) {
            throw invalidInput('The menu settings revision is required.');
        }
        const preferences = input.preferences === null ? null : parsePreferences(input.preferences);
        const pins = parsePins(input.pins ?? []);
        return models.$transaction(async (tx) => {
            const current = await getSnapshot(tx);
            if (current.revision !== input.expectedRevision) throw conflict();
            if (current.status === 'unsupported') {
                throw createAppError(
                    409,
                    'UNSUPPORTED_NAVIGATION_SETTINGS',
                    'Update Ocean Brain to edit these menu settings.',
                );
            }
            if (current.status === 'invalid' && preferences !== null) {
                throw invalidInput('Saved menu settings could not be read. Reset the menu layout first.');
            }
            for (const pin of pins) {
                const result = await tx.integrationConnection.updateMany({
                    where: { id: pin.id, updatedAt: new Date(pin.expectedUpdatedAt) },
                    data: { pinned: pin.pinned },
                });
                if (result.count !== 1) throw conflict();
            }
            if (preferences === null) {
                await tx.cache.deleteMany({ where: { key: NAVIGATION_SETTINGS_KEY } });
            } else {
                const value = JSON.stringify({ ...current.preferences, ...preferences });
                await tx.cache.upsert({
                    where: { key: NAVIGATION_SETTINGS_KEY },
                    create: { key: NAVIGATION_SETTINGS_KEY, value },
                    update: { value },
                });
            }
            return getSnapshot(tx);
        });
    },
});
