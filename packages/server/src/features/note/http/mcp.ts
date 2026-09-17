// Backward-compatible internal names for the legacy MCP routes.
export {
    createAppendNoteMarkdownHandler as createMcpAppendNoteMarkdownHandler,
    createCreateNoteHandler as createMcpCreateNoteHandler,
    createDeleteNoteHandler as createMcpDeleteNoteHandler,
    createNoteWriteBaselineHandler as createMcpNoteWriteBaselineHandler,
    createPatchNoteMarkdownHandler as createMcpPatchNoteMarkdownHandler,
    createReplaceNoteMarkdownHandler as createMcpReplaceNoteMarkdownHandler,
    createUpdateNoteMetadataHandler as createMcpUpdateNoteMetadataHandler,
} from './authoring.js';
