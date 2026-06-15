import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { localDemoOperationNames } from './client';

const CLIENT_SRC_DIR = join(process.cwd(), 'src');
const GRAPHQL_OPERATION_PATTERN = /\b(?:query|mutation)\s+([A-Z][A-Za-z0-9_]*)/g;
const SERVER_ONLY_OPERATIONS = new Set<string>();

const shouldScanFile = (path: string) => {
    return (
        /\.tsx?$/.test(path) &&
        !path.endsWith('.spec.ts') &&
        !path.endsWith('.spec.tsx') &&
        !path.endsWith('.test.ts') &&
        !path.endsWith('.test.tsx') &&
        !path.includes('/modules/local-demo/')
    );
};

const collectSourceFiles = (directory: string): string[] => {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(path);
        return shouldScanFile(path) ? [path] : [];
    });
};

const extractOperationNames = (source: string) => {
    return [...source.matchAll(GRAPHQL_OPERATION_PATTERN)].map((match) => match[1]).filter(Boolean);
};

describe('local-only demo GraphQL operation coverage', () => {
    it('has a local handler for every named client GraphQL operation', () => {
        const operationNames = collectSourceFiles(CLIENT_SRC_DIR).flatMap((path) => {
            const source = readFileSync(path, 'utf8');
            if (!source.includes('graphQuery')) return [];
            return extractOperationNames(source).map((operationName) => ({
                operationName,
                relativePath: relative(CLIENT_SRC_DIR, path),
            }));
        });
        const uniqueOperationNames = Array.from(
            new Map(operationNames.map((operation) => [operation.operationName, operation])).values(),
        ).filter(({ operationName }) => !SERVER_ONLY_OPERATIONS.has(operationName));
        const localOperations = new Set(localDemoOperationNames);
        const missingOperations = uniqueOperationNames.filter(
            ({ operationName }) => !localOperations.has(operationName),
        );

        expect(missingOperations).toEqual([]);
    });
});
