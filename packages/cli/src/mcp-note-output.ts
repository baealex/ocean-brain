export interface McpReadNoteTag {
    id: string;
    name: string;
}

export interface McpReadNoteProperty {
    key: string;
    name: string;
    value: string;
    valueType: string;
    option?: { label: string; value: string } | null;
}

export interface McpReadNote {
    id: string;
    title: string;
    contentAsMarkdown: string;
    createdAt: string;
    updatedAt: string;
    tags: McpReadNoteTag[];
    properties?: McpReadNoteProperty[];
}

export interface McpReadNoteBackReference {
    id: string;
    title: string;
    updatedAt?: string;
}

const formatBackReferenceLine = (backReference: McpReadNoteBackReference) => {
    if (backReference.updatedAt) {
        return `- ${backReference.id}: ${backReference.title} (updated: ${backReference.updatedAt})`;
    }

    return `- ${backReference.id}: ${backReference.title}`;
};

export const formatMcpReadNoteOutput = ({
    note,
    backReferences,
    maxLength
}: {
    note: McpReadNote;
    backReferences: McpReadNoteBackReference[];
    maxLength: number;
}) => {
    let markdown = note.contentAsMarkdown;
    const totalLength = markdown.length;
    const truncated = maxLength > 0 && markdown.length > maxLength;

    if (truncated) {
        markdown = markdown.slice(0, maxLength);
    }

    const backReferenceLines = backReferences.length > 0
        ? backReferences.map(formatBackReferenceLine)
        : ['- (none)'];
    const propertyLines = note.properties && note.properties.length > 0
        ? note.properties.map((property) => `- ${property.key}: ${property.option?.label ?? property.value} (${property.valueType})`)
        : ['- (none)'];

    return [
        `# ${note.title}`,
        '',
        `Tags: ${note.tags.map((tag) => tag.name).join(', ') || '(none)'}`,
        '',
        'Properties:',
        ...propertyLines,
        `Created: ${note.createdAt}`,
        `Updated: ${note.updatedAt}`,
        ...(truncated ? [`Content: ${totalLength} chars (showing first ${maxLength})`] : []),
        '',
        'Back References:',
        ...backReferenceLines,
        '',
        markdown,
        ...(truncated ? ['\n... (truncated, use maxLength: 0 to read full content)'] : [])
    ].join('\n');
};
