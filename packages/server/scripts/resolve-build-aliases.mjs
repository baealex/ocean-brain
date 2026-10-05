import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, parse } from 'es-module-lexer';

await init;

export const rewriteBuildAliases = (source, filePath, distDirectory) => {
    const [imports] = parse(source);
    let result = source;
    for (const entry of imports.toReversed()) {
        if (!entry.n?.startsWith('~/')) continue;
        const target = path.resolve(distDirectory, entry.n.slice(2));
        const relativeTarget = path.relative(distDirectory, target);
        if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
            throw new Error(`Build alias escapes the output directory: ${entry.n}`);
        }
        let specifier = path.relative(path.dirname(filePath), target).split(path.sep).join('/');
        if (!specifier.startsWith('.')) specifier = `./${specifier}`;
        const replacement = entry.d === -1 ? specifier : JSON.stringify(specifier);
        result = result.slice(0, entry.s) + replacement + result.slice(entry.e);
    }
    return result;
};

const rewriteFile = (filePath, distDirectory) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const rewritten = rewriteBuildAliases(source, filePath, distDirectory);
    if (rewritten !== source) fs.writeFileSync(filePath, rewritten);
};

const resolveDirectory = (directory, distDirectory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) resolveDirectory(filePath, distDirectory);
        else if (entry.isFile() && entry.name.endsWith('.js')) rewriteFile(filePath, distDirectory);
    }
};

export const resolveBuildAliases = (distDirectory) => resolveDirectory(distDirectory, distDirectory);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    resolveBuildAliases(fileURLToPath(new URL('../dist', import.meta.url)));
}
