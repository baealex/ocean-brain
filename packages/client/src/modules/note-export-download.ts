import {
    createHtmlAssetsZipExport,
    createHtmlDocumentExport,
    createMarkdownAssetsZipExport,
    createMarkdownDocumentExport,
    getNoteExportFilename,
    type HtmlExportMode,
    type NoteExportMetadata,
} from './note-export';

export type NoteExportFormat = 'html' | 'markdown';

export interface NoteExportContentSource {
    getHtml: () => string | undefined;
    getMarkdown: () => string | undefined;
}

export interface CreateNoteExportBlobRequest {
    fetchImpl?: typeof fetch;
    format: NoteExportFormat;
    includeAssets: boolean;
    includeMetadata: boolean;
    htmlMode: HtmlExportMode;
    metadata: NoteExportMetadata;
    source: NoteExportContentSource;
}

type NoteExportAdapter = {
    createDocumentBlob: (content: string, request: CreateNoteExportBlobRequest) => Blob;
    createZipBlob: (content: string, request: CreateNoteExportBlobRequest) => Promise<Blob>;
    extension: 'html' | 'md';
    getContent: (source: NoteExportContentSource) => string | undefined;
};

export type CreateNoteExportBlobResult =
    | {
          blob: Blob;
          filename: string;
          type: 'success';
      }
    | {
          format: NoteExportFormat;
          type: 'not-ready';
      };

const noteExportAdapters: Record<NoteExportFormat, NoteExportAdapter> = {
    html: {
        extension: 'html',
        getContent: (source) => source.getHtml(),
        createDocumentBlob: (content, request) =>
            new Blob(
                [
                    createHtmlDocumentExport(content, request.metadata, {
                        includeMetadata: request.includeMetadata,
                        mode: request.htmlMode,
                    }),
                ],
                { type: 'text/html;charset=utf-8' },
            ),
        createZipBlob: (content, request) =>
            createHtmlAssetsZipExport(content, request.metadata, {
                fetchImpl: request.fetchImpl,
                includeMetadata: request.includeMetadata,
                mode: request.htmlMode,
            }),
    },
    markdown: {
        extension: 'md',
        getContent: (source) => source.getMarkdown(),
        createDocumentBlob: (content, request) =>
            new Blob(
                [
                    createMarkdownDocumentExport(content, request.metadata, {
                        includeMetadata: request.includeMetadata,
                    }),
                ],
                { type: 'text/markdown;charset=utf-8' },
            ),
        createZipBlob: (content, request) =>
            createMarkdownAssetsZipExport(content, request.metadata, {
                fetchImpl: request.fetchImpl,
                includeMetadata: request.includeMetadata,
            }),
    },
};

export const getNoteExportOutputExtension = (format: NoteExportFormat, includeAssets: boolean) => {
    if (includeAssets) {
        return 'zip';
    }

    return noteExportAdapters[format].extension;
};

export const createNoteExportBlob = async (
    request: CreateNoteExportBlobRequest,
): Promise<CreateNoteExportBlobResult> => {
    const adapter = noteExportAdapters[request.format];
    const content = adapter.getContent(request.source);

    if (content === undefined) {
        return {
            type: 'not-ready',
            format: request.format,
        };
    }

    const extension = getNoteExportOutputExtension(request.format, request.includeAssets);
    const blob = request.includeAssets
        ? await adapter.createZipBlob(content, request)
        : adapter.createDocumentBlob(content, request);

    return {
        type: 'success',
        blob,
        filename: getNoteExportFilename(request.metadata.title, extension),
    };
};
