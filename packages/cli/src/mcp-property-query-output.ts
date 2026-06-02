export interface PropertyQueryNoteProperty {
    key: string;
    name: string;
    value: string;
    valueType: string;
    option?: {
        id: string;
        label: string;
        value: string;
        color?: string | null;
        order: number;
    } | null;
}

export interface PropertyQueryNote {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    tags: Array<{ id: string; name: string }>;
    properties?: PropertyQueryNoteProperty[];
}

export interface PropertyQueryResult {
    totalCount: number;
    notes: PropertyQueryNote[];
}

export const formatPropertyQueryResponse = ({
    result,
    query,
    includeProperties,
    propertyKeys
}: {
    result: PropertyQueryResult;
    query: Record<string, unknown>;
    includeProperties: boolean;
    propertyKeys: string[];
}) => ({
    query: {
        ...query,
        includeProperties,
        propertyKeys
    },
    totalCount: result.totalCount,
    notes: result.notes.map((note) => ({
        id: note.id,
        title: note.title,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        tags: note.tags.map((item) => item.name),
        ...(includeProperties
            ? {
                properties: propertyKeys.length > 0
                    ? (note.properties ?? []).filter((property) => propertyKeys.includes(property.key))
                    : (note.properties ?? [])
            }
            : {})
    }))
});
