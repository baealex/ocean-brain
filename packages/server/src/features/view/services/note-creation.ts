import {
    InvalidNotePropertyInputError,
    type NotePropertiesPatchInput,
    type NotePropertySetInput,
} from '~/features/note/services/properties.js';
import models, { type Prisma } from '~/models.js';
import { parseBlockNoteContent } from '~/modules/blocknote-tree.js';
import { buildViewBoardColumnWhere, buildViewWhere, getViewById } from './workspace.js';

export interface NoteViewContextInput {
    viewId: string;
    groupValue?: string | null;
    tagNames?: string[];
}

type ViewCreationDb = typeof models | Prisma.TransactionClient;

const resolveViewCreation = async ({ viewId, groupValue }: NoteViewContextInput, db: ViewCreationDb) => {
    if (!/^[1-9]\d*$/.test(viewId) || Number(viewId) > 2_147_483_647)
        throw new InvalidNotePropertyInputError('A valid view ID is required.');
    const view = await getViewById(viewId, db);
    if (!view) throw new InvalidNotePropertyInputError('This view no longer exists. Choose another view.');

    const keys = new Set(
        view.propertyFilters.filter((filter) => filter.operator !== 'notExists').map((filter) => filter.key),
    );
    const groupKey = view.displayType === 'board' ? view.displayOptions.boardGroupByPropertyKey : null;
    const dateKey =
        view.displayType === 'calendar' && view.displayOptions.calendarDateField === 'property'
            ? view.displayOptions.calendarDatePropertyKey
            : null;
    if (groupKey && groupValue !== null) keys.add(groupKey);
    if (dateKey) keys.add(dateKey);
    const definitions = await db.propertyDefinition.findMany({
        where: { key: { in: [...keys, ...(groupKey ? [groupKey] : [])] } },
        include: { options: { orderBy: { order: 'asc' } } },
    });
    const properties = [...keys].map((key) => {
        const definition = definitions.find((item) => item.key === key);
        if (!definition)
            throw new InvalidNotePropertyInputError(
                `Property ${key} is unavailable. Edit this view's filters or display settings.`,
            );
        const filters = view.propertyFilters.filter((filter) => filter.key === key);
        if (filters.some((filter) => filter.valueType !== definition.valueType))
            throw new InvalidNotePropertyInputError(`Property ${key} has changed. Update this view's filters.`);
        const equalValues = new Set(
            filters.filter((filter) => filter.operator === 'equals').map((filter) => filter.value),
        );
        const defaultValue = equalValues.size === 1 ? ([...equalValues][0] ?? null) : null;
        return {
            key,
            name: definition.name,
            valueType: definition.valueType,
            defaultValue,
            required: filters.some((filter) => filter.operator !== 'notExists') || key === dateKey,
            options: definition.options.map((option) => ({ ...option, id: String(option.id) })),
            filters,
        };
    });
    let where = buildViewWhere(view);
    if (groupValue !== undefined) {
        const definition = definitions.find((item) => item.key === groupKey);
        if (!groupKey || !definition || definition.valueType !== 'select')
            throw new InvalidNotePropertyInputError('Choose a board with an available select grouping property.');
        const option = definition.options.find((item) => item.value === groupValue);
        if (groupValue !== null && !option)
            throw new InvalidNotePropertyInputError('This board option no longer exists. Reopen the creation form.');
        where = buildViewBoardColumnWhere(view, definition.id, option?.id ?? null);
        const property = properties.find((item) => item.key === groupKey);
        if (property && groupValue !== null) {
            property.defaultValue = groupValue;
            property.required = true;
        }
    }
    return {
        where,
        context: {
            viewId: view.id,
            title: view.title,
            tagNames: view.tagNames,
            mode: view.mode,
            defaultTagNames: view.mode === 'and' || view.tagNames.length === 1 ? view.tagNames : [],
            properties,
        },
    };
};

export const getViewNoteCreationContext = async (input: NoteViewContextInput) => {
    const { context } = await resolveViewCreation(input, models);
    return context;
};

export const prepareNoteForView = async (
    tx: Prisma.TransactionClient,
    context: NoteViewContextInput,
    input: { content: string; tagIds?: string[]; properties?: NotePropertiesPatchInput },
) => {
    const { context: creation, where } = await resolveViewCreation(context, tx);
    const selectedTags = context.tagNames ?? [];
    if (selectedTags.some((name) => !creation.tagNames.includes(name)))
        throw new InvalidNotePropertyInputError(
            'The available tags changed. Reopen the creation form to choose a tag.',
        );
    const tagNames = [...new Set([...creation.defaultTagNames, ...selectedTags])];
    const existingTags = await tx.tag.findMany({ where: { id: { in: (input.tagIds ?? []).map(Number) } } });
    if (
        creation.tagNames.length &&
        !tagNames.some((name) => creation.tagNames.includes(name)) &&
        !existingTags.some((tag) => creation.tagNames.includes(tag.name))
    )
        throw new InvalidNotePropertyInputError('Choose at least one tag from this view.');

    const tags = await Promise.all(
        tagNames.map((name) => tx.tag.upsert({ where: { name }, create: { name }, update: {} })),
    );
    const existingIds = new Set(input.tagIds ?? []);
    const addedTags = tags.filter((tag) => !existingIds.has(String(tag.id)));
    const blocks = parseBlockNoteContent(input.content);
    if (!blocks) throw new InvalidNotePropertyInputError('Note content must be valid BlockNote JSON.');
    const content = addedTags.length
        ? JSON.stringify([
              {
                  type: 'paragraph',
                  content: addedTags.map((tag) => ({ type: 'tag', props: { id: String(tag.id), tag: tag.name } })),
                  children: [],
              },
              ...blocks,
          ])
        : input.content;
    const values = new Map<string, NotePropertySetInput>();
    for (const property of creation.properties) {
        if (property.defaultValue !== null)
            values.set(property.key, {
                key: property.key,
                valueType: property.valueType,
                value: property.defaultValue,
            });
    }
    for (const property of input.properties?.set ?? []) values.set(property.key, property);
    return {
        content,
        tagIds: [...new Set([...existingIds, ...tags.map((tag) => String(tag.id))])],
        properties: values.size ? { set: [...values.values()] } : undefined,
        where,
    };
};
