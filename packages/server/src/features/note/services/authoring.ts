import type { NoteViewContextInput } from '~/features/view/services/note-creation.js';
import models, { type NoteLayout } from '~/models.js';
import { extractTagIdsFromContentJson, markdownToBlocksJson } from '~/modules/blocknote.js';
import { createNoteWithContent, type NoteCreationInput } from './create.js';
import { createPlaceholderReplacer } from './placeholders.js';
import {
    type NotePropertiesByKeyPatchInput,
    type NotePropertiesPatchInput,
    resolveNotePropertiesPatchValueTypes,
    type SerializedNoteProperty,
    validateNotePropertiesPatchValues,
} from './properties.js';

interface PlaceholderRecord {
    template: string;
    replacement: string;
}

interface NoteRecord {
    workspaceId?: number;
    properties?: SerializedNoteProperty[];
    id: number;
    title: string;
    layout: NoteLayout;
    createdAt: Date;
    updatedAt: Date;
}

interface NoteAuthoringDeps {
    validateProperties: (patch: NotePropertiesByKeyPatchInput) => Promise<NotePropertiesPatchInput>;
    createNote: (input: NoteCreationInput) => Promise<NoteRecord>;
    findPlaceholders: (templates: string[]) => Promise<PlaceholderRecord[]>;
    parseMarkdownToContentJson: (markdown: string) => Promise<string>;
    extractTagIds: (contentJson: string) => string[];
}

export interface CreateNoteAuthoringInput {
    workspaceId?: string | number;
    viewContext?: NoteViewContextInput;
    properties?: NotePropertiesByKeyPatchInput;
    title: string;
    markdown?: string;
    layout?: NoteLayout;
}

export interface AuthoredNoteSummary {
    workspaceId?: string;
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

const serializeNote = (note: NoteRecord): AuthoredNoteSummary => ({
    ...(note.properties ? { properties: note.properties } : {}),
    ...(note.workspaceId !== undefined ? { workspaceId: String(note.workspaceId) } : {}),
    id: String(note.id),
    title: note.title,
    layout: note.layout,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
});

export const createNoteAuthoringService = (deps: NoteAuthoringDeps) => {
    const replacePlaceholders = createPlaceholderReplacer(deps.findPlaceholders);

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
                ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
                title: replacedTitle,
                content,
                tagIds,
                ...(properties ? { properties } : {}),
                ...(input.layout ? { layout: input.layout } : {}),
                ...(input.viewContext
                    ? { viewContext: input.viewContext, useTemplateBody: !input.markdown?.trim() }
                    : {}),
            });

            return serializeNote(note);
        },
    };
};

const defaultNoteAuthoringService = createNoteAuthoringService({
    validateProperties: async (patch) =>
        validateNotePropertiesPatchValues(await resolveNotePropertiesPatchValueTypes(patch)),
    createNote: createNoteWithContent,
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
