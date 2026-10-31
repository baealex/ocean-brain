import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import NoteEditorHeader from './NoteEditorHeader';

const renderHeader = (onTitleEnter = vi.fn()) => {
    render(
        <NoteEditorHeader
            title="Draft"
            titleRef={createRef<HTMLInputElement>()}
            isPinned={false}
            createdAt="2026-10-31 17:34:09"
            saveStatus="saved"
            savedAt=""
            savedVersion=""
            saveConfirmationRevision={0}
            onTitleChange={vi.fn()}
            onTitleEnter={onTitleEnter}
            onCopyMarkdown={vi.fn()}
            onDownloadDocument={vi.fn()}
            onTogglePinned={vi.fn()}
            onChangeLayout={vi.fn()}
            onCloneNote={vi.fn()}
            onRestoreVersion={vi.fn()}
            onDelete={vi.fn()}
            onSave={vi.fn()}
        />,
    );

    return { onTitleEnter, title: screen.getByRole('textbox', { name: 'Note title' }) };
};

describe('<NoteEditorHeader />', () => {
    it('moves on to the body when Enter is pressed in the focused title', async () => {
        const user = userEvent.setup();
        const { onTitleEnter, title } = renderHeader();
        await user.click(title);

        await user.keyboard('{Enter}');

        expect(onTitleEnter).toHaveBeenCalledTimes(1);
    });

    it('stays in the title when Enter confirms an IME composition reported by isComposing', () => {
        const { onTitleEnter, title } = renderHeader();

        // userEvent cannot simulate IME composition.
        fireEvent.keyDown(title, { key: 'Enter', isComposing: true });

        expect(onTitleEnter).not.toHaveBeenCalled();
    });

    it('stays in the title when Enter confirms an IME composition reported by keyCode 229', () => {
        const { onTitleEnter, title } = renderHeader();

        // userEvent cannot simulate IME composition.
        fireEvent.keyDown(title, { key: 'Enter', keyCode: 229 });

        expect(onTitleEnter).not.toHaveBeenCalled();
    });
});
