export interface McpReadNoteTag {
    id: string;
    name: string;
}

export interface McpReadNote {
    id: string;
    title: string;
    contentAsMarkdown: string;
    createdAt: string;
    updatedAt: string;
    tags: McpReadNoteTag[];
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

    return [
        `# ${note.title}`,
        '',
        `Tags: ${note.tags.map((tag) => tag.name).join(', ') || '(none)'}`,
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
