import { emitNoteChange } from '~/features/note/services/change-events.js';
import {
    serializeNoteProperties,
    serializePropertyDefinition,
    setNotePropertyValues,
} from '~/features/note/services/properties.js';
import { serializeSnapshotPayload } from '~/features/note/services/snapshot.js';
import {
    createNoteVersionConflictError,
    MissingNoteVersionError,
    parseNoteVersion,
} from '~/features/note/services/write-conflict.js';
import models, { type Prisma } from '~/models.js';
import { mapWorkspacePropertyKeys, type PropertyWorkspaceMapping } from './property-mapping.js';
import { parseWorkspaceId, requireWorkspace, type WorkspaceDb, WorkspaceError } from './scope.js';

export type { PropertyWorkspaceMapping } from './property-mapping.js';

const includeProperties = { properties: { include: { definition: true, option: true } } } satisfies Prisma.NoteInclude;
type MoveNote = Prisma.NoteGetPayload<{ include: typeof includeProperties }>;

const loadMove = async (id: string, targetId: string, db: WorkspaceDb) => {
    const note = await db.note.findUnique({ where: { id: parseWorkspaceId(id) }, include: includeProperties });
    if (!note) throw new WorkspaceError('NOTE_NOT_FOUND', 'This note no longer exists.');
    const sourceWorkspace = await requireWorkspace(note.workspaceId, db, true);
    const targetWorkspace = await requireWorkspace(targetId, db, true);
    if (sourceWorkspace.id === targetWorkspace.id)
        throw new WorkspaceError('WORKSPACE_UNCHANGED', 'Choose another workspace.');
    const definitions = await db.propertyDefinition.findMany({
        where: { workspaceId: targetWorkspace.id },
        orderBy: { name: 'asc' },
        include: { options: true, _count: { select: { properties: true } } },
    });
    const possibleTemplates = await db.view.findMany({
        where: { query: { contains: String(note.id) } },
        select: { id: true, title: true, query: true },
    });
    const templateViews = possibleTemplates.filter((view) => {
        try {
            const query: unknown = JSON.parse(view.query ?? '{}');
            return (
                typeof query === 'object' &&
                query !== null &&
                'defaultTemplateNoteId' in query &&
                query.defaultTemplateNoteId === String(note.id)
            );
        } catch {
            return false;
        }
    });
    return { note, sourceWorkspace, targetWorkspace, definitions, templateViews };
};

const captureMoveVersion = (tx: Prisma.TransactionClient, note: MoveNote, label: string) =>
    tx.noteSnapshot.create({
        data: {
            noteId: note.id,
            title: note.title,
            meta: JSON.stringify({ entrypoint: 'web', label }),
            payload: serializeSnapshotPayload({
                ...note,
                properties: note.properties.map((property) => ({
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
            }),
        },
    });

export const previewNoteWorkspaceMove = async (id: string, targetWorkspaceId: string) => {
    const { note, sourceWorkspace, targetWorkspace, definitions, templateViews } = await loadMove(
        id,
        targetWorkspaceId,
        models,
    );
    return {
        noteId: String(note.id),
        expectedUpdatedAt: note.updatedAt.toISOString(),
        sourceWorkspace,
        targetWorkspace,
        sourceProperties: serializeNoteProperties(note.properties),
        targetProperties: definitions.map(serializePropertyDefinition),
        templateViews: templateViews.map(({ id, title }) => ({ id: String(id), title })),
    };
};

export const moveNoteToWorkspace = async (input: {
    id: string;
    targetWorkspaceId: string;
    expectedUpdatedAt: string;
    mappings: PropertyWorkspaceMapping[];
}) => {
    const expectedTimestamp = parseNoteVersion(input.expectedUpdatedAt);
    if (expectedTimestamp === null) throw new MissingNoteVersionError();
    const result = await models.$transaction(async (tx) => {
        const { note, targetWorkspace, definitions, templateViews } = await loadMove(
            input.id,
            input.targetWorkspaceId,
            tx,
        );
        if (note.updatedAt.getTime() !== expectedTimestamp)
            throw createNoteVersionConflictError({
                expectedUpdatedAt: expectedTimestamp,
                currentUpdatedAt: note.updatedAt.getTime(),
            });
        if (templateViews.length)
            throw new WorkspaceError(
                'NOTE_TEMPLATE_IN_USE',
                `Remove this note as the default template in ${templateViews.map((view) => view.title).join(', ')} before moving it.`,
            );
        const sourceProperties = serializeNoteProperties(note.properties);
        const values = mapWorkspacePropertyKeys(sourceProperties, definitions, input.mappings);
        await captureMoveVersion(tx, note, 'Before workspace move');
        await tx.noteProperty.deleteMany({ where: { noteId: note.id } });
        await tx.note.update({
            where: { id: note.id, updatedAt: note.updatedAt },
            data: {
                workspaceId: targetWorkspace.id,
                updatedAt: new Date(Math.max(Date.now(), note.updatedAt.getTime() + 1)),
            },
        });
        if (values.length) await setNotePropertyValues(tx, note.id, { set: values });
        const moved = await tx.note.findUniqueOrThrow({ where: { id: note.id }, include: includeProperties });
        await captureMoveVersion(tx, moved, 'After workspace move');
        return { note: moved, previousWorkspaceId: note.workspaceId };
    });
    emitNoteChange({
        type: 'note.updated',
        noteId: result.note.id,
        workspaceId: result.note.workspaceId,
        previousWorkspaceId: result.previousWorkspaceId,
    });
    return result.note;
};
