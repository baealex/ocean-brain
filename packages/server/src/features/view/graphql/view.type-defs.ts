import { gql } from '~/modules/graphql.js';
import { legacyViewTypeDefs } from './view.compat.js';

export const viewType = gql`
    type ViewTemplateNote { id: ID!, title: String! }
    type ViewNoteCreationProperty {
        key: String!
        name: String!
        valueType: NotePropertyValueType!
        defaultValue: String
        required: Boolean!
        options: [NotePropertyOption!]!
        filters: [ViewPropertyFilter!]!
    }

    type ViewNoteCreationContext {
        workspaceId: ID!
        templateNote: ViewTemplateNote
        viewId: ID!
        title: String!
        tagNames: [String!]!
        mode: TagMatchMode!
        defaultTagNames: [String!]!
        properties: [ViewNoteCreationProperty!]!
    }

    input ViewNotePropertyValueInput { key: String!, value: String! }
    input ViewNoteInput {
        deletePropertyKeys: [String!]
        title: String!
        tagNames: [String!]
        properties: [ViewNotePropertyValueInput!]
    }

    type NotesQueryConditions {
        tagNames: [String!]!
        mode: TagMatchMode!
        propertyFilters: [ViewPropertyFilter!]!
        sortBy: ViewSortBy!
        sortOrder: ViewSortOrder!
    }

    type NotesQueryResult {
        resolvedScope: WorkspaceReadScope!
        query: NotesQueryConditions!
        totalCount: Int!
        notes: [Note!]!
    }

    type ViewListing { view: View!, groupTitle: String! }
    type ViewListings { resolvedScope: WorkspaceReadScope!, totalCount: Int!, views: [ViewListing!]! }
    type ViewReadRow { note: Note!, groupValue: String, calendarDate: String }
    type ViewGroupProperty { key: String!, name: String!, options: [NotePropertyOption!]! }
    type ViewReadResult {
        view: View!
        totalCount: Int!
        rows: [ViewReadRow!]!
        groupProperty: ViewGroupProperty
    }
    type ViewWorkspace {
        activeGroupId: ID
        groups: [ViewGroup!]!
    }

    type ViewGroup {
        workspaceId: ID!
        id: ID!
        title: String!
        order: Int!
        views: [View!]!
    }

    type View {
        workspaceId: ID!
        defaultTemplateNoteId: ID
        id: ID!
        groupId: ID!
        title: String!
        displayType: ViewDisplayType!
        displayOptions: ViewDisplayOptions!
        tagNames: [String!]!
        mode: TagMatchMode!
        propertyFilters: [ViewPropertyFilter!]!
        sortBy: ViewSortBy!
        sortOrder: ViewSortOrder!
        limit: Int!
        order: Int!
    }

    type ViewPropertyFilter {
        key: String!
        name: String!
        valueType: NotePropertyValueType!
        operator: ViewPropertyFilterOperator!
        value: String
    }

    type ViewDisplayOptions {
        tableColumns: [ViewTableColumn!]!
        tablePropertyKeys: [String!]!
        boardGroupByPropertyKey: String
        calendarDateField: ViewCalendarDateField!
        calendarDatePropertyKey: String
    }

    type ViewBoardColumnNotes {
        totalCount: Int!
        notes: [Note!]!
    }

    type ViewCalendarNote {
        id: ID!
        title: String!
        calendarDate: String!
    }

    enum ViewDisplayType {
        list
        table
        board
        calendar
    }

    enum ViewTableColumn {
        title
        tags
        properties
        createdAt
        updatedAt
    }

    enum ViewCalendarDateField {
        createdAt
        updatedAt
        property
    }

    enum ViewPropertyFilterOperator {
        equals
        notEquals
        contains
        notContains
        before
        after
        exists
        notExists
    }

    enum ViewSortBy {
        updatedAt
        createdAt
        title
    }

    enum ViewSortOrder {
        asc
        desc
    }

    input ViewPropertyFilterInput {
        key: String!
        valueType: NotePropertyValueType!
        operator: ViewPropertyFilterOperator!
        value: String
    }

    input ViewDisplayOptionsInput {
        tableColumns: [ViewTableColumn!]
        tablePropertyKeys: [String!]
        boardGroupByPropertyKey: String
        calendarDateField: ViewCalendarDateField
        calendarDatePropertyKey: String
    }

    input ViewInput {
        defaultTemplateNoteId: ID
        title: String
        displayType: ViewDisplayType
        displayOptions: ViewDisplayOptionsInput
        tagNames: [String!]
        mode: TagMatchMode
        propertyFilters: [ViewPropertyFilterInput!]
        sortBy: ViewSortBy
        sortOrder: ViewSortOrder
        limit: Int
    }

    input NotesByPropertiesInput {
        scope: WorkspaceScopeInput
        tagNames: [String!]
        mode: TagMatchMode
        propertyFilters: [ViewPropertyFilterInput!]!
        sortBy: ViewSortBy
        sortOrder: ViewSortOrder
    }
`;

export const viewQuery = gql`
    type Query {
        viewNoteCreationContext(viewId: ID!, groupValue: String): ViewNoteCreationContext!
        notesByQuery(input: NotesByPropertiesInput!, pagination: PaginationInput): NotesQueryResult!
        views(query: String, pagination: PaginationInput, scope: WorkspaceScopeInput): ViewListings!
        readView(id: ID!, workspaceId: ID, pagination: PaginationInput, propertyKeys: [String!], groupValue: String, dateRange: DateRangeInput): ViewReadResult!
        viewWorkspace(workspaceId: ID): ViewWorkspace!
        view(id: ID!): View
        viewNotes(
            id: ID!
            pagination: PaginationInput
            sortBy: ViewSortBy
            sortOrder: ViewSortOrder
        ): Notes!
        viewCalendarNotes(id: ID!, dateRange: DateRangeInput!): [ViewCalendarNote!]!
        viewBoardColumn(id: ID!, optionValue: String, pagination: PaginationInput): ViewBoardColumnNotes!
        notesByProperties(input: NotesByPropertiesInput!, pagination: PaginationInput): Notes!
    }
`;

export const viewMutation = gql`
    type Mutation {
        createNoteInView(viewId: ID!, input: ViewNoteInput!, groupValue: String): Note!
        createViewGroup(title: String!, workspaceId: ID): ViewGroup!
        updateViewGroup(id: ID!, title: String!): ViewGroup!
        deleteViewGroup(id: ID!): Boolean!
        setActiveViewGroup(id: ID!): ViewWorkspace!
        reorderViewGroups(groupIds: [ID!]!, workspaceId: ID): [ViewGroup!]!
        createView(groupId: ID!, input: ViewInput!): View!
        updateView(id: ID!, input: ViewInput!): View!
        deleteView(id: ID!): Boolean!
        reorderViews(groupId: ID!, viewIds: [ID!]!): [View!]!
    }
`;

export const viewTypeDefs = `
    ${viewType}
    ${viewQuery}
    ${viewMutation}
    ${legacyViewTypeDefs}
`;
