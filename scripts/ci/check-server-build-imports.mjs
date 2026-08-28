import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDirectory = path.resolve(repositoryRoot, 'packages/server/dist');
const unresolvedAliasPattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]~\//;

const findJavaScriptFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
        return findJavaScriptFiles(entryPath);
    }

    return /\.[cm]?js$/.test(entry.name) ? [entryPath] : [];
});

const unresolvedFiles = findJavaScriptFiles(distDirectory)
    .filter((filePath) => unresolvedAliasPattern.test(fs.readFileSync(filePath, 'utf8')))
    .map((filePath) => path.relative(repositoryRoot, filePath))
    .sort();

if (unresolvedFiles.length > 0) {
    throw new Error(`Server build contains unresolved path aliases:\n${unresolvedFiles.join('\n')}`);
}

console.log('Server build path alias check passed.');
