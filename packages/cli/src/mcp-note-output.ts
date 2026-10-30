import { z } from 'zod';
import { createMcpJsonToolResult, createMcpTextToolResult } from './mcp-tool-support.js';

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
    workspaceId?: string;
    workspace?: { id: string; name: string; archivedAt: string | null };
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
    contexts?: { blockId: string | null; segments: { text: string; isTarget: boolean }[] }[];
}

const formatBackReferenceLink = (backReference: McpReadNoteBackReference) => {
	return `[[${backReference.title}]](note:${backReference.id})`;
};

const formatBackReferenceLine = (backReference: McpReadNoteBackReference) => {
    const link = `- ${formatBackReferenceLink(backReference)}${backReference.updatedAt ? ` (updated: ${backReference.updatedAt})` : ''}`;
    return [link, ...(backReference.contexts ?? []).map((context) => `  > ${context.segments.map((segment) => segment.text).join('')}`)].join('\n');
};

const formatPropertyLine = (property: McpReadNoteProperty) => {
	const displayValue = (property.option?.label ?? property.value) || "(empty)";
	const rawValue = property.option?.value ?? property.value;
	const rawValueLabel = rawValue ? `, value=${rawValue}` : "";

	return `- ${property.key} (${property.name}): ${displayValue} [${property.valueType}${rawValueLabel}]`;
};

export const formatMcpReadNoteOutput = ({
	note,
	backReferences,
	maxLength,
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

	const backReferenceLines =
		backReferences.length > 0
			? backReferences.map(formatBackReferenceLine)
			: ["- (none)"];
	const propertyLines =
		note.properties && note.properties.length > 0
			? note.properties.map(formatPropertyLine)
			: ["- (none)"];

	return [
		`# ${note.title}`,
		"",
		`Tags: ${note.tags.map((tag) => tag.name).join(", ") || "(none)"}`,
		"",
		"Properties:",
		...propertyLines,
		`Created: ${note.createdAt}`,
		`Updated: ${note.updatedAt}`,
		...(truncated
			? [`Content: ${totalLength} chars (showing first ${maxLength})`]
			: []),
		"",
		"Back References:",
		...backReferenceLines,
		"",
		markdown,
		...(truncated
			? ["\n... (truncated, use maxLength: 0 to read full content)"]
			: []),
	].join("\n");
};

const linkedViewSchema = z.object({
    workspaceId: z.string().nullable().optional(),
    viewId: z.string(),
    title: z.string(),
    groupId: z.string().nullable(),
    groupTitle: z.string().nullable(),
    displayType: z.enum(['list', 'table', 'board', 'calendar']).nullable(),
    status: z.enum(['available', 'missing']),
});

const readResultSchema = z.object({
    status: z.enum(['read', 'failed', 'needs_disambiguation']),
    reason: z.string().nullable(),
    message: z.string().nullable(),
    note: z.object({
        workspaceId: z.string().optional(),
        workspace: z.object({ id: z.string(), name: z.string(), archivedAt: z.string().nullable() }).optional(),
        id: z.string(),
        title: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
        tags: z.array(z.object({ id: z.string(), name: z.string() })),
        properties: z.array(z.object({
            key: z.string(),
            name: z.string(),
            value: z.string(),
            valueType: z.string(),
            option: z.object({ label: z.string(), value: z.string() }).nullable(),
        })),
    }),
    markdown: z.string(),
    contentRange: z.object({
        start: z.number(),
        end: z.number(),
        totalLength: z.number(),
        sectionEnd: z.number(),
        hasMore: z.boolean(),
        nextOffset: z.number().nullable(),
    }).nullable(),
    candidates: z.array(z.object({ heading: z.string(), level: z.number(), start: z.number(), end: z.number() })),
    linkedViews: z.array(linkedViewSchema),
});

const formatLinkedView = (view: z.infer<typeof linkedViewSchema>) => {
    const details = [
        `viewId=${view.viewId}`,
        view.status,
        ...(view.groupTitle ? [`group=${view.groupTitle}`] : []),
        ...(view.displayType ? [`format=${view.displayType}`] : []),
    ];
    return `- ${view.title} (${details.join('; ')})`;
};

const backReferencePageSchema = z.object({
    references: z.array(z.object({
        id: z.string(), title: z.string(), hasMoreContexts: z.boolean(),
        contexts: z.array(z.object({
            blockId: z.string().nullable(),
            segments: z.array(z.object({ text: z.string(), isTarget: z.boolean() })),
        })),
    })),
    hasMore: z.boolean(), nextOffset: z.number().nullable(),
});

export const createMcpReadNoteResult = (raw: unknown, rawBackReferences: unknown, rawBackReferencePage?: unknown) => {
    const result = readResultSchema.parse(raw);
    const page = rawBackReferencePage === undefined ? undefined : backReferencePageSchema.parse(rawBackReferencePage);
    const backReferences = page ? page.references.map((reference) => ({ ...reference, contexts: reference.contexts.map((context) => ({
        ...context, segments: context.segments.map((segment) => ({ ...segment, text: segment.isTarget ? result.note.title : segment.text })),
    })) })) : z.array(z.object({ id: z.string(), title: z.string() })).parse(rawBackReferences);
    const structuredContent = { ...result, backReferences, ...(page ? { backReferencePage: { ...page, references: backReferences } } : {}) };
    if (result.status !== 'read') return createMcpJsonToolResult(structuredContent);

    const range = result.contentRange;
    const rangeText = range
        ? `\nContent range: [${range.start}, ${range.end}) of ${range.totalLength} UTF-16 units; sectionEnd: ${range.sectionEnd}; nextOffset: ${range.nextOffset ?? 'none'}`
        : '';
    const linkedViewsText = result.linkedViews.length
        ? ['', '', 'Linked views (whole note):', ...result.linkedViews.map(formatLinkedView)].join('\n')
        : '';
    const noteText = formatMcpReadNoteOutput({
        note: { ...result.note, contentAsMarkdown: result.markdown },
        backReferences,
        maxLength: 0,
    });

    return {
        ...createMcpTextToolResult(noteText + rangeText + linkedViewsText + (page?.hasMore ? `\nBack references nextOffset: ${page.nextOffset}` : '')),
        structuredContent,
    };
};
