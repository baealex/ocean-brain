import type { Note } from '~/models/note.model';
import { createLocalDemoState } from '~/test/local-demo-state';
import { notesLocalPlugin } from './plugins/notes';
import { workspacesLocalPlugin } from './plugins/workspaces';
import { LocalDemoStore } from './store';

const note = (id: string, workspaceId?: string): Note => ({
    id,
    workspaceId,
    title: `Note ${id}`,
    content: '[]',
    pinned: false,
    tags: [],
    properties: [],
    createdAt: '1',
    updatedAt: '1',
});

describe('local workspace persistence and boundaries', () => {
    afterEach(() => window.localStorage.clear());

    it('upgrades existing v6 data without changing IDs, values, or the legacy backup', () => {
        const legacy = {
            ...createLocalDemoState(),
            version: 6,
            workspaces: undefined,
            viewActiveGroupIds: undefined,
            notes: [note('legacy-note')],
            cache: { saved: 'value' },
        };
        const raw = JSON.stringify(legacy);
        window.localStorage.setItem('ocean-brain:local-only-demo:v6', raw);

        const upgraded = new LocalDemoStore().read();

        expect(upgraded.version).toBe(7);
        expect(upgraded.notes).toEqual([{ ...note('legacy-note'), workspaceId: '1' }]);
        expect(upgraded.workspaces).toEqual([expect.objectContaining({ id: '1', name: 'Notes' })]);
        expect(upgraded.cache).toEqual({ saved: 'value' });
        expect(window.localStorage.getItem('ocean-brain:local-only-demo:v6')).toBe(raw);
        expect(new LocalDemoStore().read()).toEqual(upgraded);
    });

    it('scopes before pagination, moves atomically with explicit mappings, and preserves the ID', () => {
        const state = createLocalDemoState();
        const save = vi.fn();
        workspacesLocalPlugin.graphHandlers?.CreateWorkspace({ state, save, variables: { name: 'Diet' } });
        state.notes = [note('1', '1'), note('2', '2')];
        state.propertyDefinitions = [
            { key: 'source', name: 'Status', valueType: 'text', options: [], updatedAt: '1', workspaceId: '1' },
            { key: 'target', name: 'Status', valueType: 'text', options: [], updatedAt: '1', workspaceId: '2' },
        ];
        state.notes[0].properties = [
            { key: 'source', name: 'Status', valueType: 'text', value: 'Open', updatedAt: '1' },
        ];
        const response = notesLocalPlugin.graphHandlers?.FetchNotes({
            state,
            save,
            variables: { scope: { kind: 'workspace', workspaceId: '2' }, pagination: { limit: 1, offset: 0 } },
        });
        expect(response).toMatchObject({ allNotes: { totalCount: 1, notes: [{ id: '2' }] } });
        const before = structuredClone(state);
        const rejected = workspacesLocalPlugin.graphHandlers?.MoveNoteToWorkspace({
            state,
            save,
            variables: { id: '1', targetWorkspaceId: '2', expectedUpdatedAt: '1', mappings: [] },
        });
        expect(rejected).toMatchObject({ type: 'error' });
        expect(state).toEqual(before);
        workspacesLocalPlugin.graphHandlers?.MoveNoteToWorkspace({
            state,
            save,
            variables: {
                id: '1',
                targetWorkspaceId: '2',
                expectedUpdatedAt: '1',
                mappings: [{ sourceKey: 'source', targetKey: 'target' }],
            },
        });
        expect(state.notes[0]).toMatchObject({
            id: '1',
            workspaceId: '2',
            properties: [{ key: 'target', value: 'Open' }],
        });

        workspacesLocalPlugin.graphHandlers?.UpdateWorkspace({
            state,
            save,
            variables: { id: '2', input: { archived: true } },
        });
        const archived = structuredClone(state);
        expect(() => notesLocalPlugin.graphHandlers?.DeleteNote({ state, save, variables: { id: '1' } })).toThrow(
            /Unarchive/,
        );
        expect(state).toEqual(archived);
    });
});
