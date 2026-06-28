import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastProvider } from '~/components/ui';
import NoteExportModal from './NoteExportModal';

const renderModal = () =>
    render(
        <ToastProvider>
            <NoteExportModal
                isOpen
                metadata={{ id: 'note-1', title: 'Export target' }}
                getHtml={() => '<p>Hello</p>'}
                getMarkdown={() => 'Hello'}
                onClose={vi.fn()}
            />
        </ToastProvider>,
    );

describe('<NoteExportModal />', () => {
    it('shows the resulting extension in the download button', async () => {
        const user = userEvent.setup();
        renderModal();

        expect(screen.getByRole('button', { name: 'Download .zip' })).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: 'Include local image assets' }));

        expect(screen.getByRole('button', { name: 'Download .html' })).toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: '.md' }));

        expect(screen.getByRole('button', { name: 'Download .md' })).toBeInTheDocument();
    });

    it('toggles checkbox options when their labels are clicked', async () => {
        const user = userEvent.setup();
        renderModal();

        await user.click(screen.getByText('Include local image assets'));

        expect(screen.getByRole('checkbox', { name: 'Include local image assets' })).not.toBeChecked();
        expect(screen.getByRole('button', { name: 'Download .html' })).toBeInTheDocument();
    });

    it('exposes option help without changing checkbox names', () => {
        renderModal();

        expect(screen.getByRole('checkbox', { name: 'Include local image assets' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Include local image assets help' })).toBeInTheDocument();
    });
});
