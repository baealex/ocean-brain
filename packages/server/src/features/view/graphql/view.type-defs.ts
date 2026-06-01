import { gql } from '~/modules/graphql.js';

export const viewType = gql`
    type ViewWorkspace {
        activeTabId: ID
        tabs: [ViewTab!]!
    }

    type ViewTab {
        id: ID!
        title: String!
        order: Int!
        sections: [ViewSection!]!
    }

    type ViewSection {
        id: ID!
        tabId: ID!
        title: String!
        displayType: ViewDisplayType!
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

    enum ViewDisplayType {
        list
        calendar
    }

    enum ViewPropertyFilterOperator {
        equals
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

    input ViewSectionInput {
        title: String
        displayType: ViewDisplayType
        tagNames: [String!]
        mode: TagMatchMode
        propertyFilters: [ViewPropertyFilterInput!]
        sortBy: ViewSortBy
        sortOrder: ViewSortOrder
        limit: Int
    }

    input NotesByPropertiesInput {
        tagNames: [String!]
        mode: TagMatchMode
        propertyFilters: [ViewPropertyFilterInput!]!
        sortBy: ViewSortBy
        sortOrder: ViewSortOrder
    }
`;

export const viewQuery = gql`
    type Query {
        viewWorkspace: ViewWorkspace!
        viewSection(id: ID!): ViewSection
        viewSectionNotes(id: ID!, pagination: PaginationInput): Notes!
        notesByProperties(input: NotesByPropertiesInput!, pagination: PaginationInput): Notes!
    }
`;

export const viewMutation = gql`
    type Mutation {
        createViewTab(title: String!): ViewTab!
        updateViewTab(id: ID!, title: String!): ViewTab!
        deleteViewTab(id: ID!): Boolean!
        setActiveViewTab(id: ID!): ViewWorkspace!
        reorderViewTabs(tabIds: [ID!]!): [ViewTab!]!
        createViewSection(tabId: ID!, input: ViewSectionInput!): ViewSection!
        updateViewSection(id: ID!, input: ViewSectionInput!): ViewSection!
        deleteViewSection(id: ID!): Boolean!
        reorderViewSections(tabId: ID!, sectionIds: [ID!]!): [ViewSection!]!
    }
`;

export const viewTypeDefs = `
    ${viewType}
    ${viewQuery}
    ${viewMutation}
`;
