import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NoteExternalChangeModal from './NoteExternalChangeModal';

const baseProps = {
    isOpen: true,
    isDeleted: false,
    isConflict: false,
    hasDraft: false,
    source: 'unknown' as const,
    isReloading: false,
    onReload: vi.fn(),
    onOverwrite: vi.fn(),
    onCloneDraft: vi.fn(),
    onOpenTrash: vi.fn(),
};

describe('<NoteExternalChangeModal />', () => {
    it('blocks conflict resolution behind persistent actions', async () => {
        const user = userEvent.setup();
        const onOverwrite = vi.fn();
        const onCloneDraft = vi.fn();

        render(
            <NoteExternalChangeModal
                {...baseProps}
                isConflict
                hasDraft
                onOverwrite={onOverwrite}
                onCloneDraft={onCloneDraft}
            />,
        );

        expect(screen.getByRole('dialog', { name: 'Save paused: note changed elsewhere' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reload latest' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Clone draft' }));
        await user.click(screen.getByRole('button', { name: 'Overwrite' }));

        expect(onCloneDraft).toHaveBeenCalledTimes(1);
        expect(onOverwrite).toHaveBeenCalledTimes(1);
    });

    it('names MCP as the source when an MCP update arrives', () => {
        render(<NoteExternalChangeModal {...baseProps} source="mcp" />);

        expect(screen.getByRole('dialog', { name: 'This note changed through MCP' })).toBeInTheDocument();
        expect(screen.getByText(/An MCP client changed this note while it was open here/)).toBeInTheDocument();
    });
});
