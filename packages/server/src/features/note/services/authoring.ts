import models, { type NoteLayout } from '~/models.js';
import { extractTagIdsFromContentJson, markdownToBlocksJson } from '~/modules/blocknote.js';
import { buildNoteSearchProjection } from './search.js';

interface PlaceholderRecord {
    template: string;
    replacement: string;
}

interface NoteRecord {
    id: number;
    title: string;
    layout: NoteLayout;
    createdAt: Date;
    updatedAt: Date;
}

interface NoteAuthoringDeps {
    createNote: (input: {
        title: string;
        content: string;
        layout?: NoteLayout;
        tagIds?: string[];
    }) => Promise<NoteRecord>;
    findPlaceholders: (templates: string[]) => Promise<PlaceholderRecord[]>;
    parseMarkdownToContentJson: (markdown: string) => Promise<string>;
    extractTagIds: (contentJson: string) => string[];
}

export interface CreateNoteAuthoringInput {
    title: string;
    markdown?: string;
    layout?: NoteLayout;
}

export interface AuthoredNoteSummary {
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

            const replacedTitle = await replacePlaceholders(title);
            const replacedMarkdown = await replacePlaceholders(input.markdown ?? '');
            const content = await deps.parseMarkdownToContentJson(replacedMarkdown);
            const tagIds = deps.extractTagIds(content);
            const note = await deps.createNote({
                title: replacedTitle,
                content,
                tagIds,
                ...(input.layout ? { layout: input.layout } : {}),
            });

            return serializeNote(note);
        },
    };
};

const defaultNoteAuthoringService = createNoteAuthoringService({
    createNote: async (input) => {
        return models.note.create({
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
