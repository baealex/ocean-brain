// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { NoteGraph } from '~/apis/note.api';
import { createConnectionMapData } from './graph-data';

const GRAPH_NOTE_COUNT = 1_000;
const LINKED_NOTE_COUNT = 900;
const GRAPH_BUILD_BUDGET_MS = 500;

function createBenchmarkGraph(): NoteGraph {
    const nodes = Array.from({ length: GRAPH_NOTE_COUNT }, (_, index) => ({
        id: String(index + 1),
        title: `Benchmark note ${index + 1}`,
        connections: index < LINKED_NOTE_COUNT ? (index === 0 || index === LINKED_NOTE_COUNT - 1 ? 1 : 2) : 0,
        updatedAt: String(1_785_600_000_000 + index),
        tags: [{ id: `tag-${index % 12}`, name: `@area-${index % 12}` }],
    }));
    const links = Array.from({ length: LINKED_NOTE_COUNT - 1 }, (_, index) => ({
        source: String(index + 1),
        target: String(index + 2),
    }));

    return { nodes, links };
}

describe('createConnectionMapData performance', () => {
    it('builds a 1,000-note graph with isolated notes within the release budget', () => {
        const graph = createBenchmarkGraph();
        const startedAt = performance.now();
        const result = createConnectionMapData(graph);
        const elapsedMs = performance.now() - startedAt;

        expect(result?.nodes).toHaveLength(LINKED_NOTE_COUNT);
        expect(result?.isolatedNodes).toHaveLength(GRAPH_NOTE_COUNT - LINKED_NOTE_COUNT);
        expect(result?.nodes.every((node) => !node.isIsolated)).toBe(true);
        expect(elapsedMs).toBeLessThan(GRAPH_BUILD_BUDGET_MS);
    });
});
