import type { Prisma } from '@prisma/client';
import { InvalidNotePropertyInputError } from '~/features/note/services/properties.js';
import models from '~/models.js';
import {
    buildViewBoardColumnWhere,
    buildViewSectionCalendarWhere,
    buildViewSectionWhere,
    getViewSectionById,
    normalizeViewCalendarDateRange,
    normalizeViewNotesPagination,
    serializeViewSection,
    type ViewCalendarDateRangeInput,
} from './workspace.js';

export const listViewSections = async (query = '', pagination?: { limit?: number; offset?: number }) => {
    const { limit, offset } = normalizeViewNotesPagination(pagination);
    const where: Prisma.ViewSectionWhereInput = query.trim()
        ? { OR: [{ title: { contains: query.trim() } }, { tab: { title: { contains: query.trim() } } }] }
        : {};
    const [totalCount, sections] = await Promise.all([
        models.viewSection.count({ where }),
        models.viewSection.findMany({
            where,
            include: { tab: true, tags: { orderBy: { name: 'asc' } } },
            orderBy: [{ tab: { order: 'asc' } }, { tabId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
            take: limit,
            skip: offset,
        }),
    ]);
    return {
        totalCount,
        sections: sections.map((section) => ({ section: serializeViewSection(section), tabTitle: section.tab.title })),
    };
};

export interface ReadViewSectionInput {
    id: string;
    pagination?: { limit?: number; offset?: number };
    groupValue?: string | null;
    dateRange?: ViewCalendarDateRangeInput;
    propertyKeys?: string[] | null;
}

export const readViewSection = async ({
    id,
    pagination,
    groupValue,
    dateRange,
    propertyKeys,
}: ReadViewSectionInput) => {
    const section = await getViewSectionById(id);
    if (!section) throw new InvalidNotePropertyInputError('View section not found. Use list_views to find its ID.');
    if (groupValue !== undefined && section.displayType !== 'board') {
        throw new InvalidNotePropertyInputError('groupValue is only valid for a board.');
    }
    if (dateRange && section.displayType !== 'calendar') {
        throw new InvalidNotePropertyInputError('dateRange is only valid for a calendar.');
    }
    const { limit, offset } = normalizeViewNotesPagination(pagination);
    const selectedPropertyKeys =
        propertyKeys ?? (section.displayType === 'table' ? section.displayOptions.tablePropertyKeys : []);
    const withPropertyKeys = <T>(note: T) => ({ ...note, selectedPropertyKeys });
    if (section.displayType === 'calendar') {
        if (!dateRange)
            throw new InvalidNotePropertyInputError(
                'Calendar views require dateRange (start inclusive, end exclusive; at most 32 days).',
            );
        const range = normalizeViewCalendarDateRange(dateRange);
        const field = section.displayOptions.calendarDateField;
        if (field === 'property') {
            const key = section.displayOptions.calendarDatePropertyKey;
            const definition = key ? await models.propertyDefinition.findUnique({ where: { key } }) : null;
            if (!definition || definition.valueType !== 'date') {
                throw new InvalidNotePropertyInputError('The calendar date property is unavailable.');
            }
            const where: Prisma.NotePropertyWhereInput = {
                propertyDefinitionId: definition.id,
                dateValue: { gte: range.start, lt: range.end },
                note: buildViewSectionWhere(section),
            };
            const [totalCount, values] = await Promise.all([
                models.noteProperty.count({ where }),
                models.noteProperty.findMany({
                    where,
                    include: { note: true },
                    orderBy: [{ dateValue: 'asc' }, { noteId: 'asc' }],
                    take: limit,
                    skip: offset,
                }),
            ]);
            return {
                section,
                totalCount,
                rows: values.map((value) => ({
                    note: withPropertyKeys(value.note),
                    calendarDate: value.dateValue?.toISOString().slice(0, 10),
                })),
                groupProperty: null,
            };
        }
        const where = buildViewSectionCalendarWhere(section, range);
        const [totalCount, notes] = await Promise.all([
            models.note.count({ where }),
            models.note.findMany({ where, orderBy: [{ [field]: 'asc' }, { id: 'asc' }], take: limit, skip: offset }),
        ]);
        return {
            section,
            totalCount,
            rows: notes.map((note) => ({ note: withPropertyKeys(note), calendarDate: note[field].toISOString() })),
            groupProperty: null,
        };
    }

    const key = section.displayOptions.boardGroupByPropertyKey;
    const groupProperty =
        section.displayType === 'board' && key
            ? await models.propertyDefinition.findUnique({
                  where: { key },
                  include: { options: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } },
              })
            : null;
    let where = buildViewSectionWhere(section);
    if (section.displayType === 'board') {
        if (!groupProperty || groupProperty.valueType !== 'select') {
            throw new InvalidNotePropertyInputError('The board grouping property is unavailable.');
        }
        if (groupValue !== undefined) {
            const option =
                groupValue === null
                    ? null
                    : groupProperty.options.find(
                          (candidate) => candidate.value === groupValue.trim().toLowerCase().replace(/\s+/g, '-'),
                      );
            if (groupValue !== null && !option)
                throw new InvalidNotePropertyInputError(`Property ${key} option ${groupValue} is not defined.`);
            where = buildViewBoardColumnWhere(section, groupProperty.id, option?.id ?? null);
        }
    }
    const [totalCount, notes] = await Promise.all([
        models.note.count({ where }),
        models.note.findMany({
            where,
            orderBy: [{ [section.sortBy]: section.sortOrder }, { id: 'asc' }],
            take: limit,
            skip: offset,
            include: {
                properties: { where: { propertyDefinitionId: groupProperty?.id ?? -1 }, include: { option: true } },
            },
        }),
    ]);
    return {
        section,
        totalCount,
        rows: notes.map((note) => ({
            note: withPropertyKeys(note),
            groupValue: note.properties[0]?.option?.value ?? null,
        })),
        groupProperty,
    };
};
