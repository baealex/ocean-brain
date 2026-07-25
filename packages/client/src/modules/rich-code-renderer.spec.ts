import { describe, expect, it, vi } from 'vitest';
import { getRichCodeKind, renderRichCode } from './rich-code-renderer';

const mermaidMocks = vi.hoisted(() => ({
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
        svg: '<svg aria-label="diagram"></svg>',
        bindFunctions: vi.fn(),
    }),
}));

vi.mock('mermaid', () => ({ default: mermaidMocks }));

describe('rich-code-renderer', () => {
    it('recognizes only the supported fenced-code languages', () => {
        expect(getRichCodeKind('mermaid')).toBe('mermaid');
        expect(getRichCodeKind(' Mermaid ')).toBe('mermaid');
        expect(getRichCodeKind('math')).toBe('math');
        expect(getRichCodeKind('KaTeX')).toBe('math');
        expect(getRichCodeKind('latex')).toBe('math');
        expect(getRichCodeKind('html')).toBeNull();
        expect(getRichCodeKind(undefined)).toBeNull();
    });

    it('renders Mermaid with strict security and a safe DOM id', async () => {
        const result = await renderRichCode('mermaid', 'graph TD; A-->B', ':r/1:');

        expect(mermaidMocks.initialize).toHaveBeenCalledWith({
            securityLevel: 'strict',
            startOnLoad: false,
            suppressErrorRendering: true,
        });
        expect(mermaidMocks.render).toHaveBeenCalledWith('ocean-brain-mermaid-r1', 'graph TD; A-->B');
        expect(result.html).toContain('<svg');
    });

    it('renders KaTeX with accessible MathML and rejects malformed formulas', async () => {
        const result = await renderRichCode('math', 'E = mc^2', 'formula');

        expect(result.html).toContain('katex-mathml');
        expect(result.html).toContain('E = mc^2');
        await expect(renderRichCode('math', String.raw`\frac{`, 'invalid-formula')).rejects.toThrow();
    });
});
