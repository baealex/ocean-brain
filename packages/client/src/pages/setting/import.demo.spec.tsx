import { render, screen } from '@testing-library/react';
import MarkdownImportPage from './import';

vi.mock('~/modules/demo-mode', () => ({ IS_LOCAL_ONLY_DEMO_MODE: true }));

it('keeps the import form unavailable in the local demo', () => {
    render(<MarkdownImportPage />);

    expect(screen.queryByLabelText('Upload folder')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Upload zip')).not.toBeInTheDocument();
    expect(screen.getByText('Import is available in your own Ocean Brain workspace.')).toBeInTheDocument();
});
