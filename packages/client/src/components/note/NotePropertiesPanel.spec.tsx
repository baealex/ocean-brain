import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ReactNode, type Ref } from 'react';
import { fetchNotePropertyKeys, updateNoteProperties } from '~/apis/note.api';
import { ToastProvider } from '~/components/ui';
import type { NoteProperty } from '~/models/note.model';
import { createTestQueryClient } from '~/test/test-utils';
import NotePropertiesPanel, { type NotePropertiesPanelRef } from './NotePropertiesPanel';

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

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
};

const renderPanel = (
    properties: NoteProperty[],
    onSaved = vi.fn(),
    options: { onPendingChange?: (pending: boolean) => void; ref?: Ref<NotePropertiesPanelRef> } = {},
) => {
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
                    ref={options.ref}
                    noteId="note-1"
                    properties={properties}
                    expectedUpdatedAt="1779700000000"
                    editSessionId="edit-session-1"
                    onPendingChange={options.onPendingChange}
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

    it('flushes a pending property edit through its session boundary', async () => {
        const user = userEvent.setup();
        const property = createProperty();
        const panelRef = createRef<NotePropertiesPanelRef>();
        const onPendingChange = vi.fn();
        vi.mocked(updateNoteProperties).mockResolvedValue({
            type: 'success',
            updateNoteProperties: {
                id: 'note-1',
                updatedAt: '1779700001000',
                properties: [createProperty({ value: 'Flushed summary', updatedAt: '1779700001000' })],
            },
        });
        renderPanel([property], vi.fn(), { ref: panelRef, onPendingChange });

        const valueInput = await screen.findByRole('textbox', { name: 'Property value' });
        await user.clear(valueInput);
        await user.type(valueInput, 'Flushed summary');
        await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(true));

        const result = await panelRef.current?.flushPendingSave();

        expect(result).toBe('saved');
        expect(updateNoteProperties).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(false));
    });

    it('ignores a delayed property response after pending changes are discarded', async () => {
        const user = userEvent.setup();
        const property = createProperty();
        const panelRef = createRef<NotePropertiesPanelRef>();
        const onSaved = vi.fn();
        const delayedSave = createDeferred<Awaited<ReturnType<typeof updateNoteProperties>>>();
        vi.mocked(updateNoteProperties).mockReturnValue(delayedSave.promise);
        renderPanel([property], onSaved, { ref: panelRef });

        const valueInput = await screen.findByRole('textbox', { name: 'Property value' });
        await user.clear(valueInput);
        await user.type(valueInput, 'Discarded summary');
        const flushPromise = panelRef.current?.flushPendingSave();
        await waitFor(() => expect(updateNoteProperties).toHaveBeenCalledOnce());

        panelRef.current?.discardPendingChanges();
        delayedSave.resolve({
            type: 'success',
            updateNoteProperties: {
                id: 'note-1',
                updatedAt: '1779700001000',
                properties: [createProperty({ value: 'Discarded summary', updatedAt: '1779700001000' })],
            },
        });
        await flushPromise;

        expect(onSaved).not.toHaveBeenCalled();
    });
});
