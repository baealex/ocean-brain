import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { fetchNotePropertyKeys, updateNoteProperties } from '~/apis/note.api';
import { ToastProvider } from '~/components/ui';
import type { NoteProperty } from '~/models/note.model';
import { createTestQueryClient } from '~/test/test-utils';
import NotePropertiesPanel from './NotePropertiesPanel';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: ReactNode }) => <a href="/settings/properties">{children}</a>,
}));

vi.mock('~/apis/note.api', () => ({
    fetchNotePropertyKeys: vi.fn(),
    updateNoteProperties: vi.fn(),
}));

const createProperty = (overrides: Partial<NoteProperty> = {}): NoteProperty => ({
    key: 'summary',
    name: 'Summary',
    value: 'Initial summary',
    valueType: 'text',
    createdAt: '1779700000000',
    updatedAt: '1779700000000',
    ...overrides,
});

const renderPanel = (properties: NoteProperty[], onSaved = vi.fn()) => {
    const queryClient = createTestQueryClient();

    vi.mocked(fetchNotePropertyKeys).mockResolvedValue({
        type: 'success',
        notePropertyKeys: {
            keys: properties.map((property) => ({
                key: property.key,
                name: property.name,
                valueType: property.valueType,
                noteCount: 1,
                options: [],
                updatedAt: property.updatedAt,
            })),
            totalCount: properties.length,
        },
    });

    render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <NotePropertiesPanel
                    noteId="note-1"
                    properties={properties}
                    expectedUpdatedAt="1779700000000"
                    editSessionId="edit-session-1"
                    onSaved={onSaved}
                />
            </ToastProvider>
        </QueryClientProvider>,
    );

    return { onSaved };
};

describe('<NotePropertiesPanel />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('auto-saves an edited property and reports the updated note version', async () => {
        const user = userEvent.setup();
        const property = createProperty();
        const updatedProperty = createProperty({
            value: 'Updated summary',
            updatedAt: '1779700001000',
        });
        const updatedNote = {
            id: 'note-1',
            updatedAt: '1779700001000',
            properties: [updatedProperty],
        };
        vi.mocked(updateNoteProperties).mockResolvedValue({
            type: 'success',
            updateNoteProperties: updatedNote,
        });
        const { onSaved } = renderPanel([property]);

        const valueInput = await screen.findByRole('textbox', { name: 'Property value' });
        await user.clear(valueInput);
        await user.type(valueInput, 'Updated summary');

        await waitFor(() => {
            expect(updateNoteProperties).toHaveBeenCalledWith({
                id: 'note-1',
                set: [
                    {
                        key: 'summary',
                        name: 'Summary',
                        value: 'Updated summary',
                        valueType: 'text',
                    },
                ],
                deleteKeys: [],
                editSessionId: 'edit-session-1',
                expectedUpdatedAt: '1779700000000',
            });
        });
        expect(onSaved).toHaveBeenCalledWith(updatedNote);
    });

    it('only exposes HTTP properties as external links', async () => {
        renderPanel([
            createProperty({
                key: 'website',
                name: 'Website',
                value: 'https://example.com/docs',
                valueType: 'url',
            }),
            createProperty({
                key: 'script',
                name: 'Script',
                value: 'javascript:alert(1)',
                valueType: 'url',
            }),
        ]);

        expect(await screen.findByRole('link', { name: 'Open Website' })).toHaveAttribute(
            'href',
            'https://example.com/docs',
        );
        expect(screen.queryByRole('link', { name: 'Open Script' })).not.toBeInTheDocument();
    });
});
