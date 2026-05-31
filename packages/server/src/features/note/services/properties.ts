import models, { type Note, Prisma, type PropertyValueType } from '~/models.js';
import { captureNoteBaseline } from './snapshot.js';
import { createNoteVersionConflictError, MissingNoteVersionError, parseNoteVersion } from './write-conflict.js';

export interface SerializedNotePropertyOption {
    id: string;
    label: string;
    value: string;
    color?: string | null;
    order: number;
}

export interface SerializedNoteProperty {
    key: string;
    name: string;
    value: string;
    valueType: PropertyValueType;
    option?: SerializedNotePropertyOption | null;
    createdAt: string;
    updatedAt: string;
}

export interface SerializedNotePropertyKey {
    key: string;
    name: string;
    valueType: PropertyValueType;
    noteCount: number;
    options: SerializedNotePropertyOption[];
    updatedAt: string;
}

export interface SerializedNotePropertyKeysResult {
    totalCount: number;
    keys: SerializedNotePropertyKey[];
}

export interface SerializedNotePropertyDeleteResult {
    key: string;
    name: string;
    valueType: PropertyValueType;
    affectedNoteCount: number;
    deleted: boolean;
}

export interface NotePropertySetInput {
    key: string;
    name?: string | null;
    value: string;
    valueType: PropertyValueType;
}

export interface NotePropertiesPatchInput {
    set?: NotePropertySetInput[] | null;
    deleteKeys?: string[] | null;
}

export interface NotePropertyOptionInput {
    label: string;
    value?: string | null;
    color?: string | null;
    order?: number | null;
}

export interface NotePropertyDefinitionInput {
    key: string;
    name?: string | null;
    valueType: PropertyValueType;
    options?: NotePropertyOptionInput[] | null;
}

type NotePropertyWithDefinition = Prisma.NotePropertyGetPayload<{
    include: { definition: true; option: true };
}>;

type PropertyDefinitionWithOptions = Prisma.PropertyDefinitionGetPayload<{
    include: { options: true; _count: { select: { properties: true } } };
}>;

const PROPERTY_KEY_MAX_LENGTH = 80;
const PROPERTY_NAME_MAX_LENGTH = 120;
const PROPERTY_TEXT_VALUE_MAX_LENGTH = 2000;
const PROPERTY_OPTION_LABEL_MAX_LENGTH = 80;
const PROPERTY_OPTION_VALUE_MAX_LENGTH = 80;
const PROPERTY_OPTION_LIMIT = 50;
const PROPERTY_PATCH_SET_LIMIT = 50;
const PROPERTY_PATCH_DELETE_LIMIT = 50;

export class InvalidNotePropertyInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidNotePropertyInputError';
    }
}

export class NotePropertyDeleteConfirmationRequiredError extends Error {
    code = 'NOTE_PROPERTY_DELETE_CONFIRMATION_REQUIRED' as const;
    affectedNoteCount: number;

    constructor(key: string, affectedNoteCount: number) {
        super(`Property ${key} is used by ${affectedNoteCount} note(s). Confirm deletion to remove those values.`);
        this.name = 'NotePropertyDeleteConfirmationRequiredError';
        this.affectedNoteCount = affectedNoteCount;
    }
}

const isRecordNotFoundError = (error: unknown) => {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
};

export const normalizePropertyKey = (value: string) => {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');

    if (!normalized) {
        throw new InvalidNotePropertyInputError('Property key is required.');
    }

    if (normalized.length > PROPERTY_KEY_MAX_LENGTH) {
        throw new InvalidNotePropertyInputError(`Property key must be ${PROPERTY_KEY_MAX_LENGTH} characters or fewer.`);
    }

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) {
        throw new InvalidNotePropertyInputError('Property key must use letters, numbers, dashes, or underscores.');
    }

    return normalized;
};

const normalizePropertyName = (value: string | null | undefined, key: string) => {
    const normalized = value?.trim() || key;

    if (normalized.length > PROPERTY_NAME_MAX_LENGTH) {
        throw new InvalidNotePropertyInputError(
            `Property name must be ${PROPERTY_NAME_MAX_LENGTH} characters or fewer.`,
        );
    }

    return normalized;
};

const normalizeOptionValue = (value: string) => {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');

    if (!normalized) {
        throw new InvalidNotePropertyInputError('Property option value is required.');
    }

    if (normalized.length > PROPERTY_OPTION_VALUE_MAX_LENGTH) {
        throw new InvalidNotePropertyInputError(
            `Property option value must be ${PROPERTY_OPTION_VALUE_MAX_LENGTH} characters or fewer.`,
        );
    }

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) {
        throw new InvalidNotePropertyInputError(
            'Property option value must use letters, numbers, dashes, or underscores.',
        );
    }

    return normalized;
};

const normalizeOptionLabel = (value: string) => {
    const normalized = value.trim();

    if (!normalized) {
        throw new InvalidNotePropertyInputError('Property option label is required.');
    }

    if (normalized.length > PROPERTY_OPTION_LABEL_MAX_LENGTH) {
        throw new InvalidNotePropertyInputError(
            `Property option label must be ${PROPERTY_OPTION_LABEL_MAX_LENGTH} characters or fewer.`,
        );
    }

    return normalized;
};

const normalizePropertyOptions = (options: NotePropertyOptionInput[] | null | undefined) => {
    const normalizedOptions = options ?? [];

    if (normalizedOptions.length > PROPERTY_OPTION_LIMIT) {
        throw new InvalidNotePropertyInputError(`Select properties can have up to ${PROPERTY_OPTION_LIMIT} options.`);
    }

    const seenValues = new Set<string>();

    return normalizedOptions.map((option, index) => {
        const label = normalizeOptionLabel(option.label);
        const value = normalizeOptionValue(option.value ?? label);

        if (seenValues.has(value)) {
            throw new InvalidNotePropertyInputError('Property options contain duplicate values.');
        }

        seenValues.add(value);

        return {
            label,
            value,
            color: option.color?.trim() || null,
            order: Number.isFinite(Number(option.order)) ? Number(option.order) : index,
        };
    });
};

const normalizeTextValue = (value: string) => {
    if (value.length > PROPERTY_TEXT_VALUE_MAX_LENGTH) {
        throw new InvalidNotePropertyInputError(
            `Property text value must be ${PROPERTY_TEXT_VALUE_MAX_LENGTH} characters or fewer.`,
        );
    }

    return value;
};

const normalizeDateValue = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new InvalidNotePropertyInputError('Date property values must use YYYY-MM-DD.');
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new InvalidNotePropertyInputError('Date property value is invalid.');
    }

    return date;
};

const normalizeBooleanValue = (value: string) => {
    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    throw new InvalidNotePropertyInputError('Boolean property values must be true or false.');
};

const normalizeNumberValue = (value: string) => {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
        throw new InvalidNotePropertyInputError('Number property value must be finite.');
    }

    return numberValue;
};

const serializeOption = (option: NonNullable<NotePropertyWithDefinition['option']>): SerializedNotePropertyOption => ({
    id: String(option.id),
    label: option.label,
    value: option.value,
    color: option.color,
    order: option.order,
});

const serializeDefinitionOption = (
    option: PropertyDefinitionWithOptions['options'][number],
): SerializedNotePropertyOption => ({
    id: String(option.id),
    label: option.label,
    value: option.value,
    color: option.color,
    order: option.order,
});

const serializePropertyValue = (property: NotePropertyWithDefinition) => {
    switch (property.definition.valueType) {
        case 'number':
            return property.numberValue === null ? '' : String(property.numberValue);
        case 'date':
            return property.dateValue ? property.dateValue.toISOString().slice(0, 10) : '';
        case 'boolean':
            return property.boolValue === null ? '' : String(property.boolValue);
        case 'select':
            return property.option?.value ?? '';
        case 'text':
        default:
            return property.textValue ?? '';
    }
};

export const serializeNoteProperty = (property: NotePropertyWithDefinition): SerializedNoteProperty => ({
    key: property.definition.key,
    name: property.definition.name,
    value: serializePropertyValue(property),
    valueType: property.definition.valueType,
    option: property.option ? serializeOption(property.option) : null,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
});

export const serializeNoteProperties = (properties: NotePropertyWithDefinition[]) => {
    return properties.map(serializeNoteProperty).sort((left, right) => left.key.localeCompare(right.key));
};

const serializePropertyDefinition = (definition: PropertyDefinitionWithOptions): SerializedNotePropertyKey => ({
    key: definition.key,
    name: definition.name,
    valueType: definition.valueType,
    noteCount: definition._count.properties,
    options: definition.options.sort((left, right) => left.order - right.order).map(serializeDefinitionOption),
    updatedAt: definition.updatedAt.toISOString(),
});

const buildTypedValueData = async (
    input: NotePropertySetInput,
    definitionId: number,
    tx: Pick<typeof models, 'propertyOption'> = models,
) => {
    const resetValues = {
        textValue: null,
        textValueNormalized: null,
        numberValue: null,
        dateValue: null,
        boolValue: null,
        optionId: null,
    };

    switch (input.valueType) {
        case 'number': {
            const numberValue = normalizeNumberValue(input.value);
            return { ...resetValues, numberValue };
        }
        case 'date': {
            const dateValue = normalizeDateValue(input.value);
            return { ...resetValues, dateValue };
        }
        case 'boolean': {
            const boolValue = normalizeBooleanValue(input.value);
            return { ...resetValues, boolValue };
        }
        case 'select': {
            const optionValue = normalizeOptionValue(input.value);
            const option = await tx.propertyOption.findUnique({
                where: {
                    propertyDefinitionId_value: {
                        propertyDefinitionId: definitionId,
                        value: optionValue,
                    },
                },
            });

            if (!option) {
                throw new InvalidNotePropertyInputError(`Property option ${optionValue} is not defined.`);
            }

            return { ...resetValues, optionId: option.id };
        }
        case 'text': {
            const textValue = normalizeTextValue(input.value);
            return { ...resetValues, textValue, textValueNormalized: textValue.toLowerCase() };
        }
        default:
            throw new InvalidNotePropertyInputError('Unsupported property value type.');
    }
};

const normalizePatch = (patch: NotePropertiesPatchInput) => {
    const set = patch.set ?? [];
    const deleteKeys = patch.deleteKeys ?? [];

    if (set.length === 0 && deleteKeys.length === 0) {
        throw new InvalidNotePropertyInputError('At least one property change is required.');
    }

    if (set.length > PROPERTY_PATCH_SET_LIMIT || deleteKeys.length > PROPERTY_PATCH_DELETE_LIMIT) {
        throw new InvalidNotePropertyInputError('Too many property changes in one request.');
    }

    const normalizedSet = set.map((item) => {
        const key = normalizePropertyKey(item.key);
        return {
            ...item,
            key,
            name: normalizePropertyName(item.name, key),
        };
    });
    const normalizedDeleteKeys = deleteKeys.map(normalizePropertyKey);
    const seenSetKeys = new Set<string>();
    const seenDeleteKeys = new Set<string>();

    for (const item of normalizedSet) {
        if (seenSetKeys.has(item.key)) {
            throw new InvalidNotePropertyInputError('Property patch contains duplicate keys.');
        }

        seenSetKeys.add(item.key);
    }

    for (const key of normalizedDeleteKeys) {
        if (seenDeleteKeys.has(key)) {
            throw new InvalidNotePropertyInputError('Property patch contains duplicate delete keys.');
        }

        if (seenSetKeys.has(key)) {
            throw new InvalidNotePropertyInputError('Property patch cannot set and delete the same key.');
        }

        seenDeleteKeys.add(key);
    }

    return { set: normalizedSet, deleteKeys: normalizedDeleteKeys };
};

export const listNoteProperties = async (noteId: number) => {
    const properties = await models.noteProperty.findMany({
        where: { noteId },
        include: { definition: true, option: true },
        orderBy: [{ definition: { key: 'asc' } }],
    });

    return serializeNoteProperties(properties);
};

export const listNotePropertyKeys = async (input?: { query?: string; limit?: number; offset?: number }) => {
    const normalizedQuery = input?.query?.trim();
    const where = normalizedQuery
        ? {
              OR: [{ key: { contains: normalizedQuery } }, { name: { contains: normalizedQuery } }],
          }
        : undefined;
    const take = Math.max(1, Math.min(100, Number(input?.limit ?? 50)));
    const skip = Math.max(0, Number(input?.offset ?? 0));
    const [definitions, totalCount] = await Promise.all([
        models.propertyDefinition.findMany({
            where,
            orderBy: { key: 'asc' },
            take,
            skip,
            include: { options: { orderBy: { order: 'asc' } }, _count: { select: { properties: true } } },
        }),
        models.propertyDefinition.count({ where }),
    ]);

    return {
        totalCount,
        keys: definitions.map(serializePropertyDefinition),
    } satisfies SerializedNotePropertyKeysResult;
};

export const createNotePropertyDefinition = async (input: NotePropertyDefinitionInput) => {
    const key = normalizePropertyKey(input.key);
    const name = normalizePropertyName(input.name, key);
    const options = normalizePropertyOptions(input.options);

    if (input.valueType !== 'select' && options.length > 0) {
        throw new InvalidNotePropertyInputError('Only select properties can have options.');
    }

    if (input.valueType === 'select' && options.length === 0) {
        throw new InvalidNotePropertyInputError('Select properties require at least one option.');
    }

    try {
        const definition = await models.propertyDefinition.create({
            data: {
                key,
                name,
                valueType: input.valueType,
                ...(input.valueType === 'select'
                    ? {
                          options: {
                              create: options,
                          },
                      }
                    : {}),
            },
            include: { options: { orderBy: { order: 'asc' } }, _count: { select: { properties: true } } },
        });

        return serializePropertyDefinition(definition);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new InvalidNotePropertyInputError(`Property ${key} already exists.`);
        }

        throw error;
    }
};

export const deleteNotePropertyDefinition = async ({
    key,
    confirmImpact = false,
}: {
    key: string;
    confirmImpact?: boolean;
}): Promise<SerializedNotePropertyDeleteResult | null> => {
    const normalizedKey = normalizePropertyKey(key);

    return models.$transaction(async (tx) => {
        const definition = await tx.propertyDefinition.findUnique({
            where: { key: normalizedKey },
            include: { _count: { select: { properties: true } } },
        });

        if (!definition) {
            return null;
        }

        const affectedNoteCount = definition._count.properties;

        if (affectedNoteCount > 0 && !confirmImpact) {
            throw new NotePropertyDeleteConfirmationRequiredError(normalizedKey, affectedNoteCount);
        }

        if (affectedNoteCount > 0) {
            await tx.note.updateMany({
                where: {
                    properties: {
                        some: {
                            propertyDefinitionId: definition.id,
                        },
                    },
                },
                data: {
                    updatedAt: new Date(),
                },
            });
        }

        await tx.propertyDefinition.delete({
            where: { id: definition.id },
        });

        return {
            key: definition.key,
            name: definition.name,
            valueType: definition.valueType,
            affectedNoteCount,
            deleted: true,
        };
    });
};

export const updateNotePropertiesWithVersionGuard = async ({
    id,
    patch,
    editSessionId,
    expectedUpdatedAt,
    force = false,
}: {
    id: number;
    patch: NotePropertiesPatchInput;
    editSessionId?: string;
    expectedUpdatedAt?: string;
    force?: boolean;
}): Promise<Note | null> => {
    const normalizedPatch = normalizePatch(patch);
    const expectedTimestamp = parseNoteVersion(expectedUpdatedAt);

    if (expectedTimestamp === null && !force) {
        throw new MissingNoteVersionError();
    }

    try {
        const result = await models.$transaction(async (tx) => {
            const existingNote = await tx.note.findUnique({
                where: { id },
                include: { properties: { include: { definition: true, option: true } } },
            });

            if (!existingNote) {
                return null;
            }

            if (!force && existingNote.updatedAt.getTime() !== expectedTimestamp) {
                throw createNoteVersionConflictError({
                    currentUpdatedAt: existingNote.updatedAt.getTime(),
                    expectedUpdatedAt: expectedTimestamp ?? existingNote.updatedAt.getTime(),
                });
            }

            const baseline = {
                ...existingNote,
                properties: existingNote.properties.map((property) => ({
                    key: property.definition.key,
                    name: property.definition.name,
                    valueType: property.definition.valueType,
                    textValue: property.textValue,
                    textValueNormalized: property.textValueNormalized,
                    numberValue: property.numberValue,
                    dateValue: property.dateValue,
                    boolValue: property.boolValue,
                    optionValue: property.option?.value ?? null,
                    optionLabel: property.option?.label ?? null,
                    optionColor: property.option?.color ?? null,
                })),
            };

            for (const item of normalizedPatch.set) {
                const definition = await tx.propertyDefinition.findUnique({ where: { key: item.key } });

                if (!definition) {
                    throw new InvalidNotePropertyInputError(
                        `Property ${item.key} is not defined. Create it in property settings first.`,
                    );
                }

                if (definition.valueType !== item.valueType) {
                    throw new InvalidNotePropertyInputError(
                        `Property ${item.key} already uses ${definition.valueType} values.`,
                    );
                }

                const valueData = await buildTypedValueData(item, definition.id, tx);

                await tx.noteProperty.upsert({
                    where: {
                        noteId_propertyDefinitionId: {
                            noteId: id,
                            propertyDefinitionId: definition.id,
                        },
                    },
                    create: {
                        noteId: id,
                        propertyDefinitionId: definition.id,
                        ...valueData,
                    },
                    update: valueData,
                });
            }

            if (normalizedPatch.deleteKeys.length > 0) {
                const definitions = await tx.propertyDefinition.findMany({
                    where: { key: { in: normalizedPatch.deleteKeys } },
                    select: { id: true },
                });

                if (definitions.length > 0) {
                    await tx.noteProperty.deleteMany({
                        where: {
                            noteId: id,
                            propertyDefinitionId: { in: definitions.map((definition) => definition.id) },
                        },
                    });
                }
            }

            const updatedNote = await tx.note.update({
                where: { id },
                data: { updatedAt: new Date() },
            });

            return { updatedNote, baseline };
        });

        if (!result) {
            return null;
        }

        await captureNoteBaseline({
            noteId: id,
            baseline: result.baseline,
            ...(editSessionId && !force ? { editSessionId } : {}),
            ...(force ? { force: true } : {}),
        });

        return result.updatedNote;
    } catch (error) {
        if (isRecordNotFoundError(error)) {
            return null;
        }

        throw error;
    }
};
