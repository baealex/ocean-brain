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
        tagNames: [String!]!
        mode: TagMatchMode!
        limit: Int!
        order: Int!
    }

    input ViewSectionInput {
        title: String
        tagNames: [String!]!
        mode: TagMatchMode
        limit: Int
    }
`;

export const viewQuery = gql`
    type Query {
        viewWorkspace: ViewWorkspace!
        viewSection(id: ID!): ViewSection
        viewSectionNotes(id: ID!, pagination: PaginationInput): Notes!
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
