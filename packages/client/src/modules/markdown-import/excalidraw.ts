import { type ImportIssue, type ImportNote, recordSyntax, type SyntaxCount } from './types';

const DATA_SECTION = /^(?:%%|# Excalidraw Data|#{1,2} (?:Text Elements|Element Links|Embedded Files|Drawing))[ \t]*$/;
const isDrawing = (note: ImportNote) => /\.excalidraw\.md$/i.test(note.path) || 'excalidraw-plugin' in note.properties;

/** Excalidraw saves drawings as Markdown files. Only the text a person wrote can become a note. */
export function prepareExcalidraw(notes: ImportNote[], issues: ImportIssue[], syntax: Record<string, SyntaxCount>) {
    for (const note of notes) {
        if (!isDrawing(note)) continue;
        for (const key of Object.keys(note.properties)) {
            if (key.startsWith('excalidraw-')) delete note.properties[key];
        }
        const lines = note.markdown.split('\n');
        const dataStart = lines.findIndex((line) => DATA_SECTION.test(line));
        // Text above the drawing data is the note a person wrote behind the drawing.
        const written = (dataStart < 0 ? lines : lines.slice(0, dataStart))
            .filter((line) => !line.startsWith('==⚠'))
            .join('\n')
            .trim();
        const textStart = lines.findIndex((line) => /^#{1,2} Text Elements[ \t]*$/.test(line));
        const texts: string[] = [];
        if (textStart >= 0)
            for (const line of lines.slice(textStart + 1)) {
                if (DATA_SECTION.test(line)) break;
                // Each text element ends with the drawing's element ID, which means nothing outside the drawing.
                texts.push(line.replace(/[ \t]+\^[\w-]+[ \t]*$/, ''));
            }
        note.markdown = [
            '> **Excalidraw drawing**  \n> Only the text from this drawing was imported.',
            written,
            texts.join('\n').trim(),
        ]
            .filter(Boolean)
            .join('\n\n');
        issues.push({
            kind: 'excalidraw-drawing',
            path: note.path,
            value: note.title,
            reason: 'drawing not supported; its written text was kept',
        });
        recordSyntax(syntax, 'excalidraw-drawing', 'changed');
    }
}
