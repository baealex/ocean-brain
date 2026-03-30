import assert from 'node:assert/strict';
import test from 'node:test';

import { OCEAN_BRAIN_MCP_TOOLS } from '../src/mcp.js';

test('Ocean Brain MCP tool names use explicit product-prefixed names', () => {
    assert.deepEqual(OCEAN_BRAIN_MCP_TOOLS, {
        searchNotes: 'ocean_brain_search_notes',
        readNote: 'ocean_brain_read_note',
        listTags: 'ocean_brain_list_tags',
        listNotesByTag: 'ocean_brain_list_notes_by_tag',
        listRecentNotes: 'ocean_brain_list_recent_notes',
        writeSafetyStatus: 'ocean_brain_write_safety_status',
        findNoteCleanupCandidates: 'ocean_brain_find_note_cleanup_candidates',
        createTag: 'ocean_brain_create_tag',
        deleteNote: 'ocean_brain_delete_note'
    });
});

test('Ocean Brain MCP tool names all share the ocean_brain_ prefix', () => {
    const toolNames = Object.values(OCEAN_BRAIN_MCP_TOOLS);

    assert.equal(new Set(toolNames).size, toolNames.length);

    for (const toolName of toolNames) {
        assert.match(toolName, /^ocean_brain_/);
    }
});
