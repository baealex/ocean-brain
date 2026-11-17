import { analyzeImport } from './index';

const drawing = `---

excalidraw-plugin: parsed
excalidraw-open-md: false
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'.

Notes written behind the drawing.

# Excalidraw Data

## Text Elements
Login flow ^abc12345

Retry
later ^def67890

## Element Links
abc12345: [[Start]]

%%
## Drawing
\`\`\`compressed-json
N4KAkARALgngDgUwgLgAQQQDwMYEMA2AlgCYBOuA7hADTgQBuCpAzoQPYB2KqATLZMzYBXUtiRoIACyhQ4zZAHoFAc3JRJQgEYA6bGwC2CgF7N6hbEcK4
\`\`\`
%%`;

it('keeps only the written text of an Excalidraw drawing and reports the drawing', () => {
    const plan = analyzeImport([
        { path: 'Start.md', text: 'See ![[Flow.excalidraw]]' },
        { path: 'Flow.excalidraw.md', text: drawing },
    ]);
    const note = plan.notes.find((item) => item.path === 'Flow.excalidraw.md');

    expect(note?.markdown).toContain('Excalidraw drawing');
    expect(note?.markdown).toContain('Notes written behind the drawing.');
    expect(note?.markdown).toContain('Login flow');
    expect(note?.markdown).toContain('later');
    for (const removed of ['compressed-json', 'N4KAkAR', 'EXCALIDRAW VIEW', '^abc12345', 'Element Links'])
        expect(note?.markdown).not.toContain(removed);
    expect(note?.properties).toEqual({});
    expect(plan.issues.filter((issue) => issue.kind === 'excalidraw-drawing')).toHaveLength(1);
    expect(plan.issues.some((issue) => issue.kind === 'block-id')).toBe(false);
    expect(plan.links).toContainEqual(expect.objectContaining({ from: 'Start.md', to: 'Flow.excalidraw.md' }));
});

it('leaves ordinary notes that mention Excalidraw untouched', () => {
    const plan = analyzeImport([{ path: 'Tools.md', text: '## Text Elements\nKeep this ^anchor1' }]);

    expect(plan.notes[0].markdown).toContain('## Text Elements');
    expect(plan.issues.some((issue) => issue.kind === 'excalidraw-drawing')).toBe(false);
});
