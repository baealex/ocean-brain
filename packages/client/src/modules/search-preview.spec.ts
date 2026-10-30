import { describe, expect, it } from 'vitest';

import { getSearchPreviewBlocks } from './search-preview';

describe('getSearchPreviewBlocks', () => {
    it('keeps structural meaning without returning editor-facing labels', () => {
        const content = JSON.stringify([
            {
                type: 'heading',
                props: { level: 2 },
                content: [{ type: 'text', text: 'A useful heading' }],
            },
            {
                type: 'bulletListItem',
                content: [{ type: 'text', text: 'A useful bullet' }],
            },
        ]);

        expect(getSearchPreviewBlocks(content, '')).toEqual([
            { kind: 'heading', text: 'A useful heading' },
            { kind: 'list', text: 'A useful bullet' },
        ]);
    });

    it('preserves quote and code structure for matching excerpts', () => {
        const content = JSON.stringify([
            {
                type: 'quote',
                content: [{ type: 'text', text: 'A quoted memory about the ocean' }],
            },
            {
                type: 'codeBlock',
                content: [{ type: 'text', text: 'ocean = remember()' }],
            },
        ]);

        expect(getSearchPreviewBlocks(content, 'ocean')).toEqual([
            { kind: 'quote', text: 'A quoted memory about the ocean' },
            { kind: 'code', text: 'ocean = remember()' },
        ]);
    });

    it('keeps note reference titles in the excerpt sentence', () => {
        const content = JSON.stringify([
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Verify the status columns for ' },
                    { type: 'reference', props: { id: '12', title: 'Project: Discovery Experience' } },
                    { type: 'text', text: '.' },
                ],
            },
        ]);

        expect(getSearchPreviewBlocks(content, '')).toEqual([
            { kind: 'content', text: 'Verify the status columns for Project: Discovery Experience.' },
        ]);
    });

    it('keeps inline tags in the excerpt as @ names', () => {
        const content = JSON.stringify([
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Filed under ' },
                    { type: 'tag', props: { id: '5', tag: '@project' } },
                ],
            },
        ]);

        expect(getSearchPreviewBlocks(content, '')).toEqual([{ kind: 'content', text: 'Filed under @project' }]);
    });

    it('keeps the visible text of web links in the excerpt', () => {
        const content = JSON.stringify([
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Read ' },
                    {
                        type: 'link',
                        href: 'https://example.com/guide',
                        content: [{ type: 'text', text: 'the setup guide', styles: {} }],
                    },
                    { type: 'text', text: ' first.' },
                ],
            },
        ]);

        expect(getSearchPreviewBlocks(content, '')).toEqual([{ kind: 'content', text: 'Read the setup guide first.' }]);
    });

    it('matches the query against a referenced note title', () => {
        const content = JSON.stringify([
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'An unrelated opening line.' }],
            },
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Follow up in ' },
                    { type: 'reference', props: { id: '4', title: 'Task Management Demo' } },
                ],
            },
        ]);

        expect(getSearchPreviewBlocks(content, 'management')).toEqual([
            { kind: 'content', text: 'Follow up in Task Management Demo' },
        ]);
    });

    it('does not repeat the note title as a preview block', () => {
        const content = JSON.stringify([
            {
                type: 'heading',
                props: { level: 1 },
                content: [{ type: 'text', text: 'Project kickoff' }],
            },
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Agree on the project scope.' }],
            },
        ]);

        expect(getSearchPreviewBlocks(content, 'project', { title: 'Project kickoff' })).toEqual([
            { kind: 'content', text: 'Agree on the project scope.' },
        ]);
    });

    it('prefers body content over headings when no block matches the query', () => {
        const content = JSON.stringify([
            {
                type: 'heading',
                props: { level: 2 },
                content: [{ type: 'text', text: 'Context' }],
            },
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'The first useful sentence.' }],
            },
        ]);

        expect(getSearchPreviewBlocks(content, 'meaning')).toEqual([
            { kind: 'content', text: 'The first useful sentence.' },
        ]);
    });
});
