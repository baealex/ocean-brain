import { fireEvent, render, screen } from '@testing-library/react';
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
    it('moves on to the body when Enter is pressed in the title', () => {
        const { onTitleEnter, title } = renderHeader();

        fireEvent.keyDown(title, { key: 'Enter' });

        expect(onTitleEnter).toHaveBeenCalledTimes(1);
    });

    it('keeps the title focused while Enter confirms an IME composition', () => {
        const { onTitleEnter, title } = renderHeader();

        fireEvent.keyDown(title, { key: 'Enter', isComposing: true });
        fireEvent.keyDown(title, { key: 'Enter', keyCode: 229 });

        expect(onTitleEnter).not.toHaveBeenCalled();
    });
});
