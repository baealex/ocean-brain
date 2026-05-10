interface NoteExportMetadata {
    id: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
}

export type HtmlExportMode = 'fragment' | 'standalone';

const YAML_SPECIAL_CHAR_PATTERN = /[:{}[\],&*#?|<>=!%@`-]/;

const normalizeTitleForFilename = (title: string) => {
    const normalized = title
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return normalized || 'untitled-note';
};

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatYamlString = (value: string) => {
    if (!value) {
        return '""';
    }

    if (YAML_SPECIAL_CHAR_PATTERN.test(value) || /^\s|\s$/.test(value)) {
        return JSON.stringify(value);
    }

    return value;
};

const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) {
        return undefined;
    }

    const numericTimestamp = Number(timestamp);

    if (!Number.isFinite(numericTimestamp)) {
        return timestamp;
    }

    return new Date(numericTimestamp).toISOString();
};

export const getNoteExportFilename = (title: string, extension: 'md' | 'html') => {
    return `${normalizeTitleForFilename(title)}.${extension}`;
};

export const createMarkdownFrontmatter = ({ id, title, createdAt, updatedAt }: NoteExportMetadata) => {
    const lines = ['---', `title: ${formatYamlString(title)}`, `note_id: ${formatYamlString(id)}`];
    const formattedCreatedAt = formatTimestamp(createdAt);
    const formattedUpdatedAt = formatTimestamp(updatedAt);

    if (formattedCreatedAt) {
        lines.push(`created_at: ${formatYamlString(formattedCreatedAt)}`);
    }

    if (formattedUpdatedAt) {
        lines.push(`updated_at: ${formatYamlString(formattedUpdatedAt)}`);
    }

    lines.push('source: ocean-brain', '---');

    return lines.join('\n');
};

export const createMarkdownExport = (markdown: string, metadata: NoteExportMetadata, includeMetadata = false) => {
    if (!includeMetadata) {
        return markdown;
    }

    return `${createMarkdownFrontmatter(metadata)}\n\n${markdown}`;
};

export const createHtmlExport = (
    html: string,
    metadata: NoteExportMetadata,
    { includeMetadata = false, mode = 'fragment' }: { includeMetadata?: boolean; mode?: HtmlExportMode } = {},
) => {
    const metadataComment = includeMetadata
        ? `<!--\nsource: ocean-brain\nnote_id: ${metadata.id}\ntitle: ${metadata.title}\ncreated_at: ${formatTimestamp(metadata.createdAt) ?? ''}\nupdated_at: ${formatTimestamp(metadata.updatedAt) ?? ''}\n-->\n`
        : '';

    if (mode === 'fragment') {
        return `${metadataComment}${html}`;
    }

    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(metadata.title)}</title>
</head>
<body>
${metadataComment}${html}
</body>
</html>`;
};

export const downloadTextFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};
