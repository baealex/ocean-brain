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
        number
        date
        boolean
        select
    }

    input NoteInput {
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

    input NotePropertyDefinitionInput {
        key: String!
        name: String
        valueType: NotePropertyValueType!
        options: [NotePropertyOptionInput!]
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
        id: ID!
        title: String!
        content: String!
        contentAsMarkdown: String!
        createdAt: String!
        updatedAt: String!
        pinned: Boolean!
        order: Int!
        layout: NoteLayout!
        tags: [Tag!]!
        properties: [NoteProperty!]!
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
        key: String!
        name: String!
        valueType: NotePropertyValueType!
        noteCount: Int!
        options: [NotePropertyOption!]!
        updatedAt: String!
    }

    type NotePropertyKeys {
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

    type DeletedNote {
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
    }

    type GraphLink {
        source: ID!
        target: ID!
    }

    type NoteGraph {
        nodes: [GraphNode!]!
        links: [GraphLink!]!
    }

    type Query {
        allNotes(searchFilter: SearchFilterInput, pagination: PaginationInput): Notes!
        tagNotes(searchFilter: SearchFilterInput, pagination: PaginationInput): Notes!
        notesByTagNames(tagNames: [String!]!, mode: TagMatchMode!, pagination: PaginationInput): Notes!
        notesInDateRange(dateRange: DateRangeInput): [Note!]!
        pinnedNotes: [Note!]!
        imageNotes(src: String!): [Note!]!
        backReferences(id: ID!): [Note]!
        note(id: ID!): Note!
        noteCleanupCandidates(query: String, pagination: PaginationInput): [NoteCleanupCandidate!]!
        noteCleanupPreview(id: ID!): NoteCleanupPreview
        noteSnapshots(id: ID!, limit: Int): [NoteSnapshot!]!
        noteSnapshot(id: ID!): NoteSnapshot
        notePropertyKeys(query: String, pagination: PaginationInput): NotePropertyKeys!
        trashedNote(id: ID!): DeletedNote
        trashedNotes(pagination: PaginationInput): DeletedNotes!
        noteGraph: NoteGraph!
    }
`;

export const noteMutation = gql`
    type Mutation {
        createNote(note: NoteInput!): Note!
        updateNote(id: ID!, note: NoteInput!, editSessionId: String, expectedUpdatedAt: String, force: Boolean): Note!
        deleteNote(id: ID!): Boolean!
        restoreNoteSnapshot(id: ID!): Note!
        restoreTrashedNote(id: ID!): Note!
        purgeTrashedNote(id: ID!): Boolean!
        createNotePropertyKey(input: NotePropertyDefinitionInput!): NotePropertyKey!
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
