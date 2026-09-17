import assert from 'node:assert/strict';
import test from 'node:test';

import { OCEAN_BRAIN_MCP_TOOLS } from '../src/mcp.js';

test('Ocean Brain MCP tool names use explicit product-prefixed names', () => {
    assert.deepEqual(OCEAN_BRAIN_MCP_TOOLS, {
        queryNotes: 'ocean_brain_query_notes',
        listViews: 'ocean_brain_list_views',
        readView: 'ocean_brain_read_view',
        searchNotes: 'ocean_brain_search_notes',
        readNote: 'ocean_brain_read_note',
        createNote: 'ocean_brain_create_note',
        patchNoteMarkdown: 'ocean_brain_patch_note_markdown',
        appendNoteMarkdown: 'ocean_brain_append_note_markdown',
        updateNoteMetadata: 'ocean_brain_update_note_metadata',
        replaceNoteMarkdown: 'ocean_brain_replace_note_markdown',
        listTags: 'ocean_brain_list_tags',
        listProperties: 'ocean_brain_list_properties',
        deleteNote: 'ocean_brain_delete_note',
    });
});

test('Ocean Brain MCP tool names all share the ocean_brain_ prefix', () => {
    const toolNames = Object.values(OCEAN_BRAIN_MCP_TOOLS);

    assert.equal(new Set(toolNames).size, toolNames.length);

    for (const toolName of toolNames) {
        assert.match(toolName, /^ocean_brain_/);
    }
});
