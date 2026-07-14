import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Validate the files the browser receives from the real production HTML. Keep
// this aligned with packages/client/build/client-bundling.ts.
const INITIAL_BUNDLE_BUDGET_KIB = 300;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDirectory = path.resolve(repositoryRoot, 'packages/client/dist');
const indexPath = path.resolve(distDirectory, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const assetUrls = Array.from(indexHtml.matchAll(/\b(?:href|src)="(\/assets\/[^"?#]+)"/g), (match) => match[1]);
const uniqueAssetUrls = [...new Set(assetUrls)];

if (!uniqueAssetUrls.includes('/assets/route-preload.js')) {
    throw new Error('Production index is missing the independent route preload entry.');
}

const eagerRouteChunks = uniqueAssetUrls.filter((assetUrl) => /\/note-(?:core|runtime|ui)-/.test(assetUrl));

if (eagerRouteChunks.length > 0) {
    throw new Error(`Production index eagerly loads note-only chunks: ${eagerRouteChunks.join(', ')}`);
}

const initialGzipBytes = uniqueAssetUrls.reduce((total, assetUrl) => {
    const assetPath = path.resolve(distDirectory, assetUrl.slice(1));

    if (!fs.existsSync(assetPath)) {
        throw new Error(`Production index references a missing asset: ${assetUrl}`);
    }

    return total + gzipSync(fs.readFileSync(assetPath)).byteLength;
}, gzipSync(indexHtml).byteLength);
const initialGzipKib = initialGzipBytes / 1024;

if (initialGzipKib > INITIAL_BUNDLE_BUDGET_KIB) {
    throw new Error(
        `Production initial bundle is ${initialGzipKib.toFixed(2)} KiB gzip, exceeding the ${INITIAL_BUNDLE_BUDGET_KIB} KiB budget.`,
    );
}

console.log(
    `Production initial bundle: ${initialGzipKib.toFixed(2)} KiB gzip (budget: ${INITIAL_BUNDLE_BUDGET_KIB} KiB).`,
);
