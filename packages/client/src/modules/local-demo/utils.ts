import type { Note } from '~/models/note.model';
import type { ViewPropertyFilter } from '~/models/view.model';
import type { LocalDemoState, LocalGraphVariables } from './types';

export const now = () => String(Date.now());

export const createLocalId = (prefix: string) => {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const getPagination = (variables: LocalGraphVariables, defaults = { limit: 25, offset: 0 }) => {
    const pagination = variables.pagination as { limit?: number; offset?: number } | undefined;
    return { limit: pagination?.limit ?? defaults.limit, offset: pagination?.offset ?? defaults.offset };
};

export const paginate = <T>(
    items: T[],
    variables: LocalGraphVariables,
    defaults?: { limit: number; offset: number },
) => {
    const { limit, offset } = getPagination(variables, defaults);
    return items.slice(offset, offset + limit);
};

export const getSearchFilter = (variables: LocalGraphVariables) => {
    return variables.searchFilter as
        | { query?: string; sortBy?: 'updatedAt' | 'createdAt'; sortOrder?: 'asc' | 'desc'; pinnedFirst?: boolean }
        | undefined;
};

export const getQueryText = (variables: LocalGraphVariables) => {
    return (getSearchFilter(variables)?.query ?? (variables.query as string | undefined) ?? '').trim().toLowerCase();
};

export const noteMatchesQuery = (note: Note, query: string) => {
    return (
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some((tag) => tag.name.toLowerCase().includes(query))
    );
};

export const sortNotes = (notes: Note[], variables: LocalGraphVariables) => {
    const searchFilter = getSearchFilter(variables);
    const sortBy = searchFilter?.sortBy ?? 'updatedAt';
    const direction = searchFilter?.sortOrder === 'asc' ? 1 : -1;

    return [...notes].sort((a, b) => {
        if (searchFilter?.pinnedFirst && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a[sortBy].localeCompare(b[sortBy]) * direction;
    });
};

export const findNote = (state: LocalDemoState, noteId: unknown) => {
    return state.notes.find((note) => note.id === String(noteId));
};

export const normalizeTagName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return '';
    return `@${trimmed.replace(/^[@#]+/, '')}`;
};

export const ensureTag = (state: LocalDemoState, name: string) => {
    const normalized = normalizeTagName(name);
    const existing = state.tags.find((tag) => normalizeTagName(tag.name) === normalized);
    if (existing) return existing;

    const tag = { id: createLocalId('tag'), name: normalized };
    state.tags.push(tag);
    return tag;
};

export const tagReferenceCount = (state: LocalDemoState, tagName: string) => {
    const normalized = normalizeTagName(tagName);
    return state.notes.filter((note) => note.tags.some((tag) => normalizeTagName(tag.name) === normalized)).length;
};

export const listNotesByTags = (state: LocalDemoState, tagNames: string[], mode: 'and' | 'or') => {
    const names = tagNames.map(normalizeTagName).filter(Boolean);
    if (names.length === 0) return state.notes;

    return state.notes.filter((note) => {
        const noteNames = new Set(note.tags.map((tag) => normalizeTagName(tag.name)));
        return mode === 'or' ? names.some((name) => noteNames.has(name)) : names.every((name) => noteNames.has(name));
    });
};

const dateValueToTime = (value: string) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;

    const parsedValue = Date.parse(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
};

export const isInDateRange = (value: string, dateRange?: { start?: string; end?: string }) => {
    if (!dateRange?.start || !dateRange.end) return true;

    const targetTime = dateValueToTime(value);
    const startTime = dateValueToTime(dateRange.start);
    const endTime = dateValueToTime(dateRange.end);

    if (targetTime == null || startTime == null || endTime == null) return false;
    return targetTime >= startTime && targetTime < endTime;
};

export const toTimestampString = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string') {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) return String(numericValue);

        const parsedValue = Date.parse(value);
        if (Number.isFinite(parsedValue)) return String(parsedValue);
    }

    return now();
};

const getPropertyValue = (note: Note, key: string) => note.properties?.find((property) => property.key === key)?.value;

export const applyPropertyFilters = (notes: Note[], filters: ViewPropertyFilter[] = []) => {
    return notes.filter((note) =>
        filters.every((filter) => {
            const value = getPropertyValue(note, filter.key);
            if (filter.operator === 'exists') return value != null;
            if (filter.operator === 'notExists') return value == null;
            if (value == null) return false;
            if (filter.operator === 'equals') return value === filter.value;
            if (filter.operator === 'notEquals') return value !== filter.value;
            if (filter.operator === 'contains') return value.includes(String(filter.value ?? ''));
            if (filter.operator === 'notContains') return !value.includes(String(filter.value ?? ''));
            if (filter.operator === 'before') return value < String(filter.value ?? '');
            if (filter.operator === 'after') return value > String(filter.value ?? '');
            return true;
        }),
    );
};

export const contentPreview = (content: string) =>
    content
        .replace(/[#*_`>-]/g, '')
        .trim()
        .slice(0, 180);

interface LocalReference {
    id: string;
    title: string;
}

const collectReferencesFromValue = (value: unknown, references: LocalReference[]) => {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
        value.forEach((item) => collectReferencesFromValue(item, references));
        return;
    }

    const record = value as Record<string, unknown>;
    if (record.type === 'reference' && record.props && typeof record.props === 'object') {
        const props = record.props as Record<string, unknown>;
        if (props.id != null && typeof props.title === 'string') {
            references.push({ id: String(props.id), title: props.title });
        }
    }

    Object.values(record).forEach((item) => collectReferencesFromValue(item, references));
};

export const extractNoteReferences = (note: Note) => {
    const references: LocalReference[] = [];

    try {
        collectReferencesFromValue(JSON.parse(note.content), references);
    } catch {
        collectReferencesFromValue(note.content, references);
    }

    const seen = new Set<string>();
    return references.filter((reference) => {
        const key = `${reference.id}:${reference.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};
