import { describe, expect, it } from 'vitest';
import { createLocalDemoSeed } from './seed';
import type { LocalTag } from './types';

const tags: LocalTag[] = [
    { id: 'tag-guide', name: '@guide' },
    { id: 'tag-demo', name: '@demo' },
    { id: 'tag-graph', name: '@graph' },
    { id: 'tag-project', name: '@project' },
    { id: 'tag-task', name: '@task' },
    { id: 'tag-research', name: '@research' },
    { id: 'tag-meeting', name: '@meeting' },
    { id: 'tag-editor', name: '@editor' },
    { id: 'tag-media', name: '@media' },
    { id: 'tag-archive', name: '@archive' },
];

describe('createLocalDemoSeed', () => {
    it('keeps seeded note timestamps in the past', () => {
        const nowMs = 1_710_000_000_000;
        const seed = createLocalDemoSeed({ tags, nowMs });

        expect(seed.notes.length).toBeGreaterThan(0);
        expect(seed.notes.every((note) => Number(note.createdAt) <= nowMs && Number(note.updatedAt) <= nowMs)).toBe(
            true,
        );
    });
});
