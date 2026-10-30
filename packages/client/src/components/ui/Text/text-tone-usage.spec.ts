import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT_SRC_DIR = join(process.cwd(), 'src');
// Unprefixed color utilities compete with Text's tone in generated CSS order.
const TEXT_COLOR_CLASS_PATTERN = /(?<![\w:/-])text-(?:fg-[a-z-]+|accent-[a-z-]+|current|inherit)(?:\/\d+)?(?![\w-])/g;

const collectSourceFiles = (directory: string): string[] => {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(path);
        return path.endsWith('.tsx') && !path.endsWith('.spec.tsx') ? [path] : [];
    });
};

const readOpeningTags = (source: string, tagName: string) => {
    const tags: { line: number; text: string }[] = [];
    const startPattern = new RegExp(`<${tagName}(?=[\\s>])`, 'g');

    for (const match of source.matchAll(startPattern)) {
        let depth = 0;
        let end = match.index + match[0].length;
        while (end < source.length) {
            const char = source[end];
            if (char === '{') depth += 1;
            if (char === '}') depth -= 1;
            if (char === '>' && depth === 0) break;
            end += 1;
        }
        tags.push({
            line: source.slice(0, match.index).split('\n').length,
            text: source.slice(match.index, end + 1),
        });
    }

    return tags;
};

describe('Text color usage', () => {
    it('sets text colors through the tone prop instead of className', () => {
        const violations = collectSourceFiles(CLIENT_SRC_DIR).flatMap((path) => {
            const source = readFileSync(path, 'utf8');
            return readOpeningTags(source, 'Text').flatMap(({ line, text }) => {
                const colorClasses = text.match(TEXT_COLOR_CLASS_PATTERN);
                return colorClasses ? [`${relative(CLIENT_SRC_DIR, path)}:${line} ${colorClasses.join(' ')}`] : [];
            });
        });

        expect(violations).toEqual([]);
    });
});
