import { type NoteViewContextInput, prepareNoteForView } from '~/features/view/services/note-creation.js';
import models, { type NoteLayout } from '~/models.js';
import { replaceNoteReferences } from './note-reference-index.js';
import {
    InvalidNotePropertyInputError,
    type NotePropertiesPatchInput,
    serializeNoteProperties,
    setNotePropertyValues,
} from './properties.js';
import { buildNoteSearchProjection } from './search.js';

export interface NoteCreationInput {
    title: string;
    content: string;
    layout?: NoteLayout;
    tagIds?: string[];
    properties?: NotePropertiesPatchInput;
    viewContext?: NoteViewContextInput;
    useTemplateBody?: boolean;
}

export const createNoteWithContent = async (input: NoteCreationInput) => {
    return models.$transaction(async (tx) => {
        const viewInput = input.viewContext ? await prepareNoteForView(tx, input.viewContext, input) : null;
        const prepared = viewInput ?? input;
        const note = await tx.note.create({
            data: {
                title: prepared.title,
                content: prepared.content,
                ...buildNoteSearchProjection({
                    title: prepared.title,
                    content: prepared.content,
                }),
                layout: input.layout ?? viewInput?.layout,
                ...(prepared.tagIds ? { tags: { connect: prepared.tagIds.map((id) => ({ id: Number(id) })) } } : {}),
            },
        });

        if (prepared.properties) await setNotePropertyValues(tx, note.id, prepared.properties);
        if (viewInput) {
            const matchesView = await tx.note.findFirst({
                where: { AND: [{ id: note.id }, viewInput.where] },
                select: { id: true },
            });
            if (!matchesView) {
                throw new InvalidNotePropertyInputError(
                    'The note does not match this view. Check its tags and property values.',
                );
            }
        }
        await replaceNoteReferences(tx, note.id, prepared.content);
        const properties = await tx.noteProperty.findMany({
            where: { noteId: note.id },
            include: { definition: true, option: true },
            orderBy: { definition: { key: 'asc' } },
        });
        return { ...note, properties: serializeNoteProperties(properties) };
    });
};
