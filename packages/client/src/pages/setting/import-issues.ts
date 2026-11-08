const descriptions: Record<string, [string, string]> = {
    'discarded-property': [
        'Skipped properties',
        'Metadata fields you chose to skip, including publishing settings disabled by default.',
    ],
    'duplicate-heading': ['Repeated titles', 'An opening heading identical to the note title was removed.'],
    'export-metadata': ['Export identifiers', 'Ocean Brain export identifiers were removed before creating new notes.'],
    'empty-property': ['Empty properties', 'Metadata fields without a value were skipped.'],
    'invalid-date': [
        'Unrecognized dates',
        'These values remain properties because they could not be used as original dates.',
    ],
    'metadata-fallback': [
        'Metadata kept as text',
        'Unrecognized YAML remains visible in the note instead of being discarded.',
    ],
    'skipped-file': ['Skipped files', 'These files are settings, unused attachments, or unsupported input files.'],
    'oversized-note': [
        'Notes too large to import',
        'Split these Markdown files and import them separately; other notes can continue.',
    ],
    'link-target-skipped': [
        'Links to skipped notes',
        'The destination was too large; the original link label remains visible.',
    ],
    'unresolved-link': ['Unresolved note links', 'The destination is missing or ambiguous among the selected files.'],
    'unresolved-image': [
        'Unresolved images or embeds',
        'The embedded destination is missing or ambiguous among the selected files.',
    ],
    'unsupported-attachment': [
        'Attachments kept as filenames',
        'The image uploader does not support this format; its filename remains visible.',
    ],
    'unsupported-html-image': ['Images without a source', 'These HTML images have no usable source address.'],
    'image-size-hint': [
        'Adjusted image sizes',
        'Numeric aliases become image widths; height follows the original aspect ratio.',
    ],
    'link-anchor': [
        'Removed heading and block targets',
        'The note link is retained while unsupported heading or block targets are removed.',
    ],
    'link-title': [
        'Removed link tooltips',
        'Link destinations and visible labels remain; tooltip titles were removed.',
    ],
    'block-id': ['Removed block identifiers', 'Obsidian block anchor markers were removed from the visible text.'],
    'callout-fold': ['Removed folding controls', 'Callout text remains visible without its expand or collapse marker.'],
    'repeated-comment': ['Repeated guidance', 'Identical hidden comments found in at least three notes were removed.'],
    'generated-footer': ['Generated footers', 'Repeated edit, copy, and download controls were removed.'],
    'literal-html-marker': [
        'HTML kept as visible text',
        'Unsupported or incomplete HTML markers were escaped to preserve their text.',
    ],
    'disabled-tag': ['Tags turned off', 'These tags will not be created; original body text remains visible.'],
    'unsupported-tag': ['Tag values kept as text', 'Values that cannot be tag names remain visible in the note.'],
    'notion-icon': [
        'Removed Notion icons',
        'Tool-generated callout icons were removed while the callout text remains.',
    ],
    'notion-missing-mention': ['Missing Notion mentions', 'The export already lacks these mention destinations.'],
    'notion-view-settings': ['Removed database view settings', 'Exported filter and sorting controls were removed.'],
    'notion-self-link': [
        'Removed database self-links',
        'The CSV table was merged here, so its redundant link became plain text.',
    ],
    'csv-metadata-consumed': [
        'Merged CSV files',
        'CSV rows and properties were merged into their existing database note.',
    ],
    'csv-row-unmatched': ['CSV rows without a unique page', 'The complete row remains in the database table.'],
    'csv-column-count': ['CSV rows with extra or missing cells', 'The complete row was retained for review.'],
    'invalid-csv': ['Unreadable CSV files', 'These CSV files could not be parsed; the reason is listed below.'],
    'empty-csv': ['Empty CSV files', 'These files contain no database columns to import.'],
    'image-upload-failed': ['Image upload failures', 'These images were not uploaded; their filenames remain visible.'],
    'note-create-failed': [
        'Note creation failures',
        'These files did not become notes; other files may have succeeded.',
    ],
    'note-save-failed': [
        'Content save failures',
        'These created notes could not receive their content; trash-all remains available.',
    ],
    'link-target-create-failed': ['Links to failed notes', 'Destination creation failed; the link label was retained.'],
    'import-interrupted': [
        'Interrupted import',
        'Review created and unsaved notes before retrying or moving this batch to trash.',
    ],
    'note-not-created': ['Notes not created', 'The import stopped before creating these notes.'],
    'note-content-not-saved': [
        'Notes with unsaved content',
        'The import stopped after creation; these notes remain covered by trash-all.',
    ],
    'trash-failed': ['Trash failures', 'These notes could not be moved to trash; the reason is listed below.'],
};

export function describeImportIssue(kind: string) {
    const [label, description] = descriptions[kind] ?? [
        kind.replace(/-/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase()),
        'Review the item and its reason below. The original category is retained in the downloaded report.',
    ];
    return { label, description };
}
