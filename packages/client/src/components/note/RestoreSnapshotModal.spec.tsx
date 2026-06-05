import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import { fetchNoteSnapshot, fetchNoteSnapshotDiff, fetchNoteSnapshots, restoreNoteSnapshot } from '~/apis/note.api';
import { ToastProvider } from '~/components/ui';
import { createTestQueryClient } from '~/test/test-utils';
import RestoreSnapshotModal from './RestoreSnapshotModal';

vi.mock('~/apis/note.api', () => ({
    fetchNoteSnapshot: vi.fn(),
    fetchNoteSnapshotDiff: vi.fn(),
    fetchNoteSnapshots: vi.fn(),
    restoreNoteSnapshot: vi.fn(),
}));

const snapshot = {
    id: 'snapshot-1',
    title: 'Project note before edit',
    contentPreview: 'First paragraph preview.',
    contentAsMarkdown: 'First paragraph preview.\n\nSecond paragraph with details.',
    createdAt: '2026-03-31T01:00:00.000Z',
    meta: {
        entrypoint: 'web',
        label: 'Web browser',
    },
};

const renderModal = (props: Partial<ComponentProps<typeof RestoreSnapshotModal>> = {}) => {
    const queryClient = createTestQueryClient();
    const onClose = vi.fn();
    const onRestored = vi.fn();

    render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <RestoreSnapshotModal isOpen noteId="7" onClose={onClose} onRestored={onRestored} {...props} />
            </ToastProvider>
        </QueryClientProvider>,
    );

    return { onClose, onRestored };
};

describe('<RestoreSnapshotModal />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchNoteSnapshots).mockResolvedValue({
            type: 'success',
            noteSnapshots: [snapshot],
        } as never);
        vi.mocked(fetchNoteSnapshot).mockResolvedValue({
            type: 'success',
            noteSnapshot: snapshot,
        } as never);
        vi.mocked(fetchNoteSnapshotDiff).mockResolvedValue({
            type: 'success',
            noteSnapshotDiff: {
                noteId: '7',
                mode: 'snapshot_to_current',
                before: { kind: 'snapshot', id: 'snapshot-1', title: 'Project note before edit' },
                after: { kind: 'current_note', id: '7', title: 'Current note' },
                diff: {
                    markdown: '--- before.md\n+++ after.md\n@@ -1 +1 @@\n-Old line\n+New line',
                    changedLineCount: 1,
                    changedCharCount: 16,
                    beforeMarkdownSha256: 'before-hash',
                    afterMarkdownSha256: 'after-hash',
                },
            },
        } as never);
        vi.mocked(restoreNoteSnapshot).mockResolvedValue({
            type: 'success',
            restoreNoteSnapshot: {
                id: '7',
                title: 'Project note before edit',
                updatedAt: '1774915200000',
                layout: 'wide',
                pinned: false,
                content: 'content',
            },
        } as never);
    });

    it('shows a git-style snapshot diff', async () => {
        const user = userEvent.setup();

        renderModal();

        await user.click(await screen.findByRole('button', { name: /compare/i }));

        expect(screen.getByRole('dialog', { name: 'Snapshot Diff' })).toBeInTheDocument();
        await waitFor(() => expect(fetchNoteSnapshotDiff).toHaveBeenCalledWith('snapshot-1', 'current'));
        expect(await screen.findByText('-Old line')).toBeInTheDocument();
        expect(screen.getByText('+New line')).toBeInTheDocument();
    });

    it('shows snapshot content before restoring', async () => {
        const user = userEvent.setup();

        renderModal();

        expect(await screen.findByText('First paragraph preview.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /compare/i }));
        expect(screen.getByRole('button', { name: /^back$/i })).toHaveFocus();

        await user.click(screen.getByRole('button', { name: /view content/i }));

        expect(screen.getByRole('dialog', { name: 'Snapshot Content' })).toBeInTheDocument();
        await waitFor(() => expect(fetchNoteSnapshot).toHaveBeenCalledWith('snapshot-1'));
        expect(await screen.findByText(/Second paragraph with details/)).toBeInTheDocument();
    });

    it('restores from the content preview screen', async () => {
        const user = userEvent.setup();
        const { onClose, onRestored } = renderModal();

        await user.click(await screen.findByRole('button', { name: /compare/i }));
        await user.click(screen.getByRole('button', { name: /view content/i }));
        await user.click(screen.getByRole('button', { name: /restore this version/i }));

        await waitFor(() => expect(restoreNoteSnapshot).toHaveBeenCalledWith('snapshot-1', expect.anything()));
        expect(onRestored).toHaveBeenCalledWith(expect.objectContaining({ id: '7' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
