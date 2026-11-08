import { uploadImage } from '~/apis/image-upload-adapter';
import * as api from '~/apis/markdown-import.api';
import { analyzeImport } from './index';
import { runMarkdownImport } from './run';

vi.mock('~/apis/markdown-import.api', () => ({
    startMarkdownImport: vi.fn(),
    createImportNotes: vi.fn(),
    saveImportNotes: vi.fn(),
}));
vi.mock('~/apis/image-upload-adapter', () => ({ uploadImage: vi.fn() }));

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.startMarkdownImport).mockResolvedValue({ token: 'session', mappings: [], batchSize: 25 });
    vi.mocked(api.createImportNotes).mockImplementation(async (_token, notes) => ({
        notes: notes.map((note, index) => ({ path: note.path, id: String(index + 1) })),
        errors: [],
    }));
    vi.mocked(api.saveImportNotes).mockImplementation(async (_token, notes) => ({
        saved: notes.map((note) => note.path),
        errors: [],
    }));
});
afterEach(() => vi.useRealTimers());

const execute = (plan: ReturnType<typeof analyzeImport>) =>
    runMarkdownImport({
        plan,
        workspaceId: '1',
        mappings: [],
        onProgress: vi.fn(),
        onCheckpoint: vi.fn(),
        cancelled: () => false,
    });

it('continues saving other notes when a rendered request exceeds the per-note limit', async () => {
    const plan = analyzeImport([
        { path: 'Large.md', text: 'Initial' },
        { path: 'Small.md', text: 'Keep this' },
    ]);
    plan.notes[0].markdown = '가'.repeat(300_000);

    const result = await execute(plan);

    expect(result.saved).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({ kind: 'note-save-failed', path: 'Large.md' }));
    expect(result.issues.some((issue) => issue.kind === 'import-interrupted')).toBe(false);
    expect(
        vi
            .mocked(api.saveImportNotes)
            .mock.calls.flatMap(([, notes]) => notes)
            .map((note) => note.path),
    ).toContain('Small.md');
});

it.each(['start', 'create', 'save', 'image'] as const)('retries a 429 during %s after Retry-After', async (stage) => {
    vi.useFakeTimers();
    const plan = analyzeImport([
        { path: 'A.md', text: '![[pixel.png]]' },
        { path: 'pixel.png', bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) },
    ]);
    vi.mocked(uploadImage).mockResolvedValue('/assets/images/pixel.png');
    const operation = {
        start: api.startMarkdownImport,
        create: api.createImportNotes,
        save: api.saveImportNotes,
        image: uploadImage,
    }[stage];
    vi.mocked(operation).mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 429, headers: { 'retry-after': '2' } },
    });

    const pending = execute(plan);
    await vi.advanceTimersByTimeAsync(1999);
    expect(operation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(operation).toHaveBeenCalledTimes(2);
    expect(result.saved).toBe(1);
    expect(
        result.issues.some((issue) => issue.kind === 'import-interrupted' || issue.kind === 'image-upload-failed'),
    ).toBe(false);
});
