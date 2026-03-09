import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
    '.md',
    '.yml',
    '.yaml',
    '.css',
    '.scss',
    '.html',
    '.svg'
]);

const ROOT_TEXT_FILES = new Set([
    '.editorconfig',
    '.gitattributes'
]);

const decoder = new TextDecoder('utf-8', { fatal: true });

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

const filesToCheck = trackedFiles.filter((file) => (
    ROOT_TEXT_FILES.has(file) || TEXT_EXTENSIONS.has(path.extname(file))
));

const issues = [];

for (const file of filesToCheck) {
    const bytes = readFileSync(file);

    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        issues.push(`${file}: UTF-8 BOM is not allowed`);
    }

    let text;

    try {
        text = decoder.decode(bytes);
    } catch {
        issues.push(`${file}: file does not decode as UTF-8`);
        continue;
    }

    if (file.startsWith('packages/client/src/') && text.includes('\uFFFD')) {
        issues.push(`${file}: contains U+FFFD replacement character`);
    }
}

if (issues.length > 0) {
    console.error('Encoding check failed:');

    for (const issue of issues) {
        console.error(`- ${issue}`);
    }

    process.exit(1);
}

console.log(`Encoding check passed for ${filesToCheck.length} tracked text files.`);
