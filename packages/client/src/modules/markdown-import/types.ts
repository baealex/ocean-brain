/** Browser and Node share these transforms. File I/O, zip decoding and persistence live at the edges. */
export interface ImportFile {
    path: string;
    text?: string;
    bytes?: Uint8Array;
}

export type PropertyType = 'text' | 'url' | 'number' | 'date' | 'boolean' | 'select';
export type MetadataValue = string | string[];
export interface ImportIssue {
    kind: string;
    path: string;
    value: string;
    reason: string;
}
export interface SyntaxCount {
    kept: number;
    changed: number;
    dropped: number;
}
export interface ImportNote {
    path: string;
    title: string;
    markdown: string;
    aliases: string[];
    tags: string[];
    properties: Record<string, MetadataValue>;
    createdAt?: string;
    updatedAt?: string;
    originalId?: string;
}
export interface PropertySuggestion {
    name: string;
    valueType: PropertyType;
    values: string[];
    list: boolean;
    defaultOff: boolean;
}
export interface ImportOptions {
    lineBreaks?: 'preserve' | 'paragraph';
    disabledTags?: string[];
    enabledToolProperties?: string[];
    discardedProperties?: string[];
    listPropertiesAsTags?: string[];
}
export interface ImportPlan {
    files: ImportFile[];
    notes: ImportNote[];
    assets: Array<{ path: string; contentType: string }>;
    issues: ImportIssue[];
    syntax: Record<string, SyntaxCount>;
    properties: PropertySuggestion[];
    tags: string[];
    obsidian: boolean;
    duplicateTitles: Array<{ title: string; count: number }>;
    links: Array<{ from: string; to: string; label: string }>;
    images: Array<{ from: string; to: string }>;
}

export const recordSyntax = (
    counts: Record<string, SyntaxCount>,
    kind: string,
    action: keyof SyntaxCount,
    count = 1,
) => {
    const entry = counts[kind] ?? { kept: 0, changed: 0, dropped: 0 };
    counts[kind] = entry;
    entry[action] += count;
};
