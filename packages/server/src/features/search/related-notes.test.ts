import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createSearchRelatedNotes,
    type SearchRelatedNoteCandidate,
    type SearchRelatedNoteSource,
} from './related-notes.js';

const createSource = (input: Partial<SearchRelatedNoteSource> & Pick<SearchRelatedNoteSource, 'id'>) => ({
    id: input.id,
    tags: input.tags ?? [],
});

const createCandidate = (
    input: Partial<SearchRelatedNoteCandidate> & Pick<SearchRelatedNoteCandidate, 'id'>,
): SearchRelatedNoteCandidate => ({
    id: input.id,
    title: input.title ?? `Note ${input.id}`,
    updatedAt: input.updatedAt ?? new Date('2026-07-01T00:00:00.000Z'),
    linked: input.linked ?? false,
    backlink: input.backlink ?? false,
    sharedTagNames: input.sharedTagNames ?? [],
});

const createService = (source: SearchRelatedNoteSource | null, candidates: SearchRelatedNoteCandidate[]) =>
    createSearchRelatedNotes({
        findSourceNote: async () => source,
        findCandidates: async () => candidates,
    });

test('returns indexed links and shared-tag notes with explicit reasons', async () => {
    const findRelatedNotes = createService(createSource({ id: 1, tags: [{ id: 10, name: '@project' }] }), [
        createCandidate({ id: 2, title: 'Linked note', linked: true, sharedTagNames: ['@project'] }),
        createCandidate({ id: 3, title: 'Backlink note', backlink: true, sharedTagNames: ['@project'] }),
        createCandidate({ id: 4, title: 'Shared tag note', sharedTagNames: ['@project'] }),
        createCandidate({ id: 5, title: 'Unrelated note' }),
    ]);

    assert.deepEqual(await findRelatedNotes(1), [
        {
            id: 2,
            title: 'Linked note',
            reasons: ['Linked from this note', 'Shares @project'],
        },
        {
            id: 3,
            title: 'Backlink note',
            reasons: ['Backlink to this note', 'Shares @project'],
        },
        {
            id: 4,
            title: 'Shared tag note',
            reasons: ['Shares @project'],
        },
    ]);
});

test('bounds related notes and returns no results for unknown notes', async () => {
    const findRelatedNotes = createService(
        createSource({ id: 1, tags: [{ id: 10, name: '@project' }] }),
        Array.from({ length: 8 }, (_, index) => createCandidate({ id: index + 2, sharedTagNames: ['@project'] })),
    );

    assert.equal((await findRelatedNotes(1, 99)).length, 5);

    const unknownNoteResolver = createService(null, []);
    assert.deepEqual(await unknownNoteResolver(99), []);
});
