import type { IResolvers } from '@graphql-tools/utils';
import { createView, reorderViewGroups, reorderViews } from '../services/workspace.js';
import { viewMutationResolvers } from './view.mutation.resolver.js';
import { viewQueryResolvers } from './view.query.resolver.js';

// Legacy names are confined to this adapter; domain services use View and ViewGroup.
export const legacyViewTypeDefs = `
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
        displayOptions: ViewDisplayOptions!
        tagNames: [String!]!
        mode: TagMatchMode!
        propertyFilters: [ViewPropertyFilter!]!
        sortBy: ViewSortBy!
        sortOrder: ViewSortOrder!
        limit: Int!
        order: Int!
    }
    input ViewSectionInput {
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
    type ViewSectionListing { section: ViewSection!, tabTitle: String! }
    type ViewSectionListings { totalCount: Int!, sections: [ViewSectionListing!]! }
    extend type ViewWorkspace {
        activeTabId: ID @deprecated(reason: "Use activeGroupId.")
        tabs: [ViewTab!]! @deprecated(reason: "Use groups.")
    }
    extend type ViewReadResult {
        section: ViewSection! @deprecated(reason: "Use view.")
    }
    extend type Query {
        viewSections(query: String, pagination: PaginationInput): ViewSectionListings! @deprecated(reason: "Use views.")
        readViewSection(id: ID!, pagination: PaginationInput, propertyKeys: [String!], groupValue: String, dateRange: DateRangeInput): ViewReadResult! @deprecated(reason: "Use readView.")
        viewSection(id: ID!): ViewSection @deprecated(reason: "Use view.")
        viewSectionNotes(
            id: ID!
            pagination: PaginationInput
            sortBy: ViewSortBy
            sortOrder: ViewSortOrder
        ): Notes! @deprecated(reason: "Use viewNotes.")
        viewSectionCalendarNotes(id: ID!, dateRange: DateRangeInput!): [ViewCalendarNote!]! @deprecated(reason: "Use viewCalendarNotes.")
        viewSectionBoardColumn(id: ID!, optionValue: String, pagination: PaginationInput): ViewBoardColumnNotes! @deprecated(reason: "Use viewBoardColumn.")
    }

    extend type Mutation {
        createViewTab(title: String!): ViewTab! @deprecated(reason: "Use createViewGroup.")
        updateViewTab(id: ID!, title: String!): ViewTab! @deprecated(reason: "Use updateViewGroup.")
        deleteViewTab(id: ID!): Boolean! @deprecated(reason: "Use deleteViewGroup.")
        setActiveViewTab(id: ID!): ViewWorkspace! @deprecated(reason: "Use setActiveViewGroup.")
        reorderViewTabs(tabIds: [ID!]!): [ViewTab!]! @deprecated(reason: "Use reorderViewGroups.")
        createViewSection(tabId: ID!, input: ViewSectionInput!): ViewSection! @deprecated(reason: "Use createView.")
        updateViewSection(id: ID!, input: ViewSectionInput!): ViewSection! @deprecated(reason: "Use updateView.")
        deleteViewSection(id: ID!): Boolean! @deprecated(reason: "Use deleteView.")
        reorderViewSections(tabId: ID!, sectionIds: [ID!]!): [ViewSection!]! @deprecated(reason: "Use reorderViews.")
    }
`;

export const legacyViewResolvers = {
    Query: {
        viewSections: viewQueryResolvers.views,
        readViewSection: viewQueryResolvers.readView,
        viewSection: viewQueryResolvers.view,
        viewSectionNotes: viewQueryResolvers.viewNotes,
        viewSectionCalendarNotes: viewQueryResolvers.viewCalendarNotes,
        viewSectionBoardColumn: viewQueryResolvers.viewBoardColumn,
    },
    Mutation: {
        createViewTab: viewMutationResolvers.createViewGroup,
        updateViewTab: viewMutationResolvers.updateViewGroup,
        deleteViewTab: viewMutationResolvers.deleteViewGroup,
        setActiveViewTab: viewMutationResolvers.setActiveViewGroup,
        reorderViewTabs: (_source, { tabIds }) => reorderViewGroups(tabIds),
        createViewSection: (_source, { tabId, input }) => createView(tabId, input),
        updateViewSection: viewMutationResolvers.updateView,
        deleteViewSection: viewMutationResolvers.deleteView,
        reorderViewSections: (_source, { tabId, sectionIds }) => reorderViews(tabId, sectionIds),
    },
    ViewWorkspace: {
        activeTabId: (workspace) => workspace.activeGroupId,
        tabs: (workspace) => workspace.groups,
    },
    ViewTab: { sections: (group) => group.views },
    ViewSection: { tabId: (view) => view.groupId },
    ViewSectionListing: {
        section: (listing) => listing.view,
        tabTitle: (listing) => listing.groupTitle,
    },
    ViewSectionListings: { sections: (listing) => listing.views },
    ViewReadResult: { section: (result) => result.view },
} satisfies IResolvers;
