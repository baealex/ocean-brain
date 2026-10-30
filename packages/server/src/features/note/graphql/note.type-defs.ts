import { gql } from '~/modules/graphql.js';

export const noteType = gql`
    input PaginationInput {
        limit: Int!
        offset: Int!
    }

    input SearchFilterInput {
        query: String!
        sortBy: String
        sortOrder: String
        pinnedFirst: Boolean
    }

    input DateRangeInput {
        start: String!
        end: String!
    }

    enum NoteLayout {
        narrow
        wide
        full
    }

    enum TagMatchMode {
        and
        or
    }

    enum NotePropertyValueType {
        text
        url
        number
        date
        boolean
        select
    }

    input NoteInput {
        workspaceId: ID
        title: String
        content: String
        layout: NoteLayout
    }

    input NotePropertySetInput {
        key: String!
        name: String
        value: String!
        valueType: NotePropertyValueType!
    }

    input NotePropertyOptionInput {
        label: String!
        value: String
        color: String
        order: Int
    }

    input NotePropertyOptionUpdateInput {
        id: ID
        label: String!
        value: String
        color: String
        order: Int
    }

    input NotePropertyDefinitionInput {
        workspaceId: ID
        key: String
        name: String
        valueType: NotePropertyValueType!
        options: [NotePropertyOptionInput!]
    }

    input NotePropertyDefinitionUpdateInput {
        name: String
        options: [NotePropertyOptionUpdateInput!]
    }

    input NotePropertiesPatchInput {
        set: [NotePropertySetInput!]
        deleteKeys: [String!]
    }

    input NoteOrderInput {
        id: ID!
        order: Int!
    }

    type Tag {
        id: ID!
        name: String!
        createdAt: String!
        updatedAt: String!
    }

    type Note {
        workspaceId: ID!
        workspace: Workspace!
        id: ID!
        title: String!
        content: String!
        contentPreview: String!
        contentAsMarkdown: String!
        createdAt: String!
        updatedAt: String!
        pinned: Boolean!
        order: Int!
        layout: NoteLayout!
        tags: [Tag!]!
        properties(keys: [String!]): [NoteProperty!]!
    }

    type ReferenceContextSegment { text: String!, isTarget: Boolean! }
    type BackReferenceContext { blockId: String, segments: [ReferenceContextSegment!]! }
    type BackReferenceDetail {
        id: ID!
        title: String!
        contexts: [BackReferenceContext!]!
        hasMoreContexts: Boolean!
    }
    type BackReferencePage {
        references: [BackReferenceDetail!]!
        hasMore: Boolean!
        nextOffset: Int
    }

    type NoteProperty {
        key: String!
        name: String!
        value: String!
        valueType: NotePropertyValueType!
        createdAt: String!
        option: NotePropertyOption
        updatedAt: String!
    }

    type NotePropertyOption {
        id: ID!
        label: String!
        value: String!
        color: String
        order: Int!
    }

    type NotePropertyKey {
        workspaceId: ID!
        key: String!
        name: String!
        valueType: NotePropertyValueType!
        noteCount: Int!
        options: [NotePropertyOption!]!
        updatedAt: String!
    }

    type NotePropertyKeys {
        resolvedScope: WorkspaceReadScope!
        totalCount: Int!
        keys: [NotePropertyKey!]!
    }

    type NotePropertyDeleteResult {
        key: String!
        name: String!
        valueType: NotePropertyValueType!
        affectedNoteCount: Int!
        deleted: Boolean!
    }

    type Notes {
        totalCount: Int!
        notes: [Note!]!
    }

    type NoteCleanupBackReference {
        id: ID!
        title: String!
    }

    type NoteCleanupCandidate {
        id: ID!
        title: String!
        updatedAt: String!
        pinned: Boolean!
        tagNames: [String!]!
        reminderCount: Int!
        backReferenceCount: Int!
        matchedTerms: [String!]!
        reasons: [String!]!
        requiresForce: Boolean!
        forceReasons: [String!]!
    }

    type NoteCleanupPreview {
        id: ID!
        title: String!
        updatedAt: String!
        pinned: Boolean!
        tagNames: [String!]!
        reminderCount: Int!
        backReferences: [NoteCleanupBackReference!]!
        orphanedTagNames: [String!]!
        requiresForce: Boolean!
        forceReasons: [String!]!
    }

    type NoteSnapshotMeta {
        entrypoint: String
        label: String
    }

    type NoteSnapshot {
        id: ID!
        title: String!
        contentPreview: String!
        contentAsMarkdown: String!
        createdAt: String!
        meta: NoteSnapshotMeta!
    }

    enum NoteSnapshotDiffTarget {
        NEXT
        PREVIOUS
        CURRENT
    }

    type NoteSnapshotDiffEndpoint {
        kind: String!
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
        meta: NoteSnapshotMeta
    }

    type NoteSnapshotDiffDetail {
        markdown: String!
        changedLineCount: Int!
        changedCharCount: Int!
        beforeMarkdownSha256: String!
        afterMarkdownSha256: String!
    }

    type NoteSnapshotDiff {
        noteId: ID!
        mode: String!
        before: NoteSnapshotDiffEndpoint!
        after: NoteSnapshotDiffEndpoint!
        diff: NoteSnapshotDiffDetail!
    }

    type DeletedNote {
        workspaceId: ID!
        id: ID!
        title: String!
        createdAt: String!
        updatedAt: String!
        deletedAt: String!
        contentPreview: String!
        contentAsMarkdown: String
        pinned: Boolean!
        order: Int!
        layout: NoteLayout!
        tagNames: [String!]!
    }

    type DeletedNotes {
        totalCount: Int!
        notes: [DeletedNote!]!
    }
`;

export const noteQuery = gql`
    type GraphNode {
        id: ID!
        title: String!
        connections: Int!
        updatedAt: String!
        tags: [Tag!]!
    }

    type GraphLink {
        source: ID!
        target: ID!
    }

    type NoteGraph {
        nodes: [GraphNode!]!
        links: [GraphLink!]!
    }

    type NoteContentRange { start: Int!, end: Int!, totalLength: Int!, sectionEnd: Int!, hasMore: Boolean!, nextOffset: Int }
    type NoteHeadingCandidate { heading: String!, level: Int!, start: Int!, end: Int! }
    enum NoteLinkedViewStatus { available missing }
    type NoteLinkedView {
        workspaceId: ID
        viewId: ID!
        title: String!
        groupId: ID
        groupTitle: String
        displayType: ViewDisplayType
        status: NoteLinkedViewStatus!
    }
    type NoteReadResult {
        status: String!
        reason: String
        message: String
        note: Note!
        markdown: String!
        contentRange: NoteContentRange
        candidates: [NoteHeadingCandidate!]!
        "All unique linked views from the whole note, independent of the returned Markdown range."
        linkedViews: [NoteLinkedView!]!
    }
    type Query {
        allNotes(searchFilter: SearchFilterInput, pagination: PaginationInput, scope: WorkspaceScopeInput): Notes!
        tagNotes(searchFilter: SearchFilterInput, pagination: PaginationInput, scope: WorkspaceScopeInput): Notes!
        notesByTagNames(tagNames: [String!]!, mode: TagMatchMode!, pagination: PaginationInput, scope: WorkspaceScopeInput): Notes!
        notesInDateRange(dateRange: DateRangeInput, scope: WorkspaceScopeInput): [Note!]!
        pinnedNotes(scope: WorkspaceScopeInput): [Note!]!
        imageNotes(src: String!): [Note!]!
        backReferences(id: ID!): [Note]!
        backReferenceDetails(id: ID!, limit: Int, offset: Int): BackReferencePage!
        note(id: ID!): Note!
        noteRead(id: ID!, offset: Int, maxLength: Int, heading: String, expectedUpdatedAt: String): NoteReadResult!
        noteCleanupCandidates(query: String, pagination: PaginationInput): [NoteCleanupCandidate!]!
        noteCleanupPreview(id: ID!): NoteCleanupPreview
        noteSnapshots(id: ID!, limit: Int): [NoteSnapshot!]!
        noteSnapshot(id: ID!): NoteSnapshot
        noteSnapshotDiff(id: ID!, compareToSnapshotId: ID, target: NoteSnapshotDiffTarget, contextLines: Int): NoteSnapshotDiff
        notePropertyKeys(query: String, pagination: PaginationInput, scope: WorkspaceScopeInput): NotePropertyKeys!
        trashedNote(id: ID!): DeletedNote
        trashedNotes(pagination: PaginationInput, scope: WorkspaceScopeInput): DeletedNotes!
        noteGraph(scope: WorkspaceScopeInput): NoteGraph!
    }
`;

export const noteMutation = gql`
    type Mutation {
        createNote(note: NoteInput!): Note!
        updateNote(id: ID!, note: NoteInput!, editSessionId: String, expectedUpdatedAt: String, force: Boolean): Note!
        deleteNote(id: ID!): Boolean!
        restoreNoteSnapshot(id: ID!, expectedUpdatedAt: String!, mappings: [PropertyWorkspaceMappingInput!]): Note!
        restoreTrashedNote(id: ID!): Note!
        purgeTrashedNote(id: ID!): Boolean!
        createNotePropertyKey(input: NotePropertyDefinitionInput!): NotePropertyKey!
        updateNotePropertyKey(key: String!, input: NotePropertyDefinitionUpdateInput!): NotePropertyKey!
        deleteNotePropertyKey(key: String!, confirmImpact: Boolean): NotePropertyDeleteResult!
        updateNoteProperties(
            id: ID!
            patch: NotePropertiesPatchInput!
            editSessionId: String
            expectedUpdatedAt: String!
            force: Boolean
        ): Note!
        pinNote(id: ID!, pinned: Boolean!): Note!
        reorderNotes(notes: [NoteOrderInput!]!): [Note!]!
    }
`;

export const noteTypeDefs = `
    ${noteType}
    ${noteQuery}
    ${noteMutation}
`;
