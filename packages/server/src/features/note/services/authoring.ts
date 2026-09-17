import models, { type NoteLayout } from '~/models.js';
import { extractTagIdsFromContentJson, markdownToBlocksJson } from '~/modules/blocknote.js';
import { replaceNoteReferences } from './note-reference-index.js';
import {
    type NotePropertiesByKeyPatchInput,
    type NotePropertiesPatchInput,
    resolveNotePropertiesPatchValueTypes,
    type SerializedNoteProperty,
    serializeNoteProperties,
    setNotePropertyValues,
    validateNotePropertiesPatchValues,
} from './properties.js';
import { buildNoteSearchProjection } from './search.js';

interface PlaceholderRecord {
    template: string;
    replacement: string;
}

interface NoteRecord {
    properties?: SerializedNoteProperty[];
    id: number;
    title: string;
    layout: NoteLayout;
    createdAt: Date;
    updatedAt: Date;
}

interface NoteAuthoringDeps {
    validateProperties: (patch: NotePropertiesByKeyPatchInput) => Promise<NotePropertiesPatchInput>;
    createNote: (input: {
        title: string;
        content: string;
        layout?: NoteLayout;
        tagIds?: string[];
        properties?: NotePropertiesPatchInput;
    }) => Promise<NoteRecord>;
    findPlaceholders: (templates: string[]) => Promise<PlaceholderRecord[]>;
    parseMarkdownToContentJson: (markdown: string) => Promise<string>;
    extractTagIds: (contentJson: string) => string[];
}

export interface CreateNoteAuthoringInput {
    properties?: Pick<NotePropertiesByKeyPatchInput, 'set'>;
    title: string;
    markdown?: string;
    layout?: NoteLayout;
}

export interface AuthoredNoteSummary {
    properties?: SerializedNoteProperty[];
    id: string;
    title: string;
    layout: NoteLayout;
    createdAt: string;
    updatedAt: string;
}

export class InvalidNoteAuthoringInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidNoteAuthoringInputError';
    }
}

const PLACEHOLDER_PREFIX = '{%';
const PLACEHOLDER_SUFFIX = '%}';

const serializeNote = (note: NoteRecord): AuthoredNoteSummary => ({
    ...(note.properties ? { properties: note.properties } : {}),
    id: String(note.id),
    title: note.title,
    layout: note.layout,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
});

const extractPlaceholderTemplates = (value: string) => {
    return Array.from(
        new Set(
            Array.from(
                value.matchAll(new RegExp(`${PLACEHOLDER_PREFIX}([^}]+)${PLACEHOLDER_SUFFIX}`, 'g')),
                (match) => match[1],
            ),
        ),
    );
};

export const createNoteAuthoringService = (deps: NoteAuthoringDeps) => {
    const replacePlaceholders = async (value: string) => {
        const templates = extractPlaceholderTemplates(value);

        if (templates.length === 0) {
            return value;
        }

        const placeholders = await deps.findPlaceholders(templates);
        let replacedValue = value;

        for (const placeholder of placeholders) {
            replacedValue = replacedValue.replace(
                new RegExp(`${PLACEHOLDER_PREFIX}${placeholder.template}${PLACEHOLDER_SUFFIX}`, 'g'),
                placeholder.replacement,
            );
        }

        return replacedValue;
    };

    return {
        createNote: async (input: CreateNoteAuthoringInput): Promise<AuthoredNoteSummary> => {
            const title = input.title.trim();

            if (!title) {
                throw new InvalidNoteAuthoringInputError('A note title is required.');
            }

            const properties = input.properties ? await deps.validateProperties(input.properties) : undefined;
            const replacedTitle = await replacePlaceholders(title);
            const replacedMarkdown = await replacePlaceholders(input.markdown ?? '');
            const content = await deps.parseMarkdownToContentJson(replacedMarkdown);
            const tagIds = deps.extractTagIds(content);
            const note = await deps.createNote({
                title: replacedTitle,
                content,
                tagIds,
                ...(properties ? { properties } : {}),
                ...(input.layout ? { layout: input.layout } : {}),
            });

            return serializeNote(note);
        },
    };
};

const defaultNoteAuthoringService = createNoteAuthoringService({
    validateProperties: async (patch) =>
        validateNotePropertiesPatchValues(await resolveNotePropertiesPatchValueTypes(patch)),
    createNote: async (input) => {
        return models.$transaction(async (tx) => {
            const note = await tx.note.create({
                data: {
                    title: input.title,
                    content: input.content,
                    ...buildNoteSearchProjection({
                        title: input.title,
                        content: input.content,
                    }),
                    ...(input.layout ? { layout: input.layout } : {}),
                    ...(input.tagIds ? { tags: { connect: input.tagIds.map((id) => ({ id: Number(id) })) } } : {}),
                },
            });

            if (input.properties) await setNotePropertyValues(tx, note.id, input.properties);
            await replaceNoteReferences(tx, note.id, input.content);
            const properties = await tx.noteProperty.findMany({
                where: { noteId: note.id },
                include: { definition: true, option: true },
                orderBy: { definition: { key: 'asc' } },
            });
            return { ...note, properties: serializeNoteProperties(properties) };
        });
    },
    findPlaceholders: async (templates) => {
        if (templates.length === 0) {
            return [];
        }

        return models.placeholder.findMany({
            select: {
                template: true,
                replacement: true,
            },
            where: { template: { in: templates } },
        });
    },
    parseMarkdownToContentJson: markdownToBlocksJson,
    extractTagIds: extractTagIdsFromContentJson,
});

export const createNoteFromMarkdown = async (input: CreateNoteAuthoringInput) => {
    return defaultNoteAuthoringService.createNote(input);
};
