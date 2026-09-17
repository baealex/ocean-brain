import { GraphQLError, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { type MarkdownReadInput, readMarkdownRange } from '~/features/note/services/markdown-read.js';
import models from '~/models.js';
import schema from '~/schema/index.js';

// Deliberately explicit: new browser/admin queries never become public by accident.
const READ_FIELDS = new Set([
    'allNotes',
    'note',
    'noteRead',
    'backReferences',
    'notesByTagNames',
    'allTags',
    'tagsByNames',
    'notePropertyKeys',
    'notesByQuery',
    'notesByProperties',
    'viewSections',
    'readViewSection',
    'searchNotes',
]);

const readNote = async (_: unknown, { id }: { id: string }) => {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new GraphQLError('Invalid note id.');
    const note = await models.note.findUnique({ where: { id: Number(id) } });
    if (!note) throw new GraphQLError('Note not found.');
    return note;
};

const query = schema.getQueryType();
if (!query) throw new Error('The core query schema is missing.');
const fields = Object.fromEntries(Object.entries(query.toConfig().fields).filter(([name]) => READ_FIELDS.has(name)));
fields.note = { ...fields.note, resolve: readNote };
fields.noteRead = {
    ...fields.noteRead,
    resolve: async (_: unknown, { id, ...input }: MarkdownReadInput & { id: string }) => {
        const note = await readNote(_, { id });
        const { blocksToMarkdown } = await import('~/modules/blocknote.js');
        return { note, ...readMarkdownRange(await blocksToMarkdown(note.content), note.updatedAt, input) };
    },
};

for (const field of Object.values(fields)) {
    const resolve = field.resolve;
    if (!resolve) continue;
    field.resolve = (source, args, context, info) => {
        if (
            args.pagination &&
            (!Number.isInteger(args.pagination.limit) ||
                args.pagination.limit < 1 ||
                args.pagination.limit > 100 ||
                !Number.isInteger(args.pagination.offset) ||
                args.pagination.offset < 0)
        ) {
            throw new GraphQLError('pagination requires limit 1–100 and offset >= 0.');
        }
        const normalizedArgs = { ...args };
        if (field.args?.pagination && !args.pagination) normalizedArgs.pagination = { limit: 25, offset: 0 };
        if (field.args?.searchFilter && !args.searchFilter) normalizedArgs.searchFilter = { query: '' };
        return resolve(source, normalizedArgs, context, info);
    };
}

export const integrationReadSchema = new GraphQLSchema({ query: new GraphQLObjectType({ name: 'Query', fields }) });
