import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchNote, fetchNotes } from '~/apis/note.api';
import { Button, Input, Label, Text } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';

const TemplateTitle = ({ id }: { id: string }) => {
    const { data, isPending, isError } = useQuery({
        queryKey: queryKeys.notes.detail(id),
        async queryFn() {
            const response = await fetchNote(id);
            if (response.type === 'error') throw response;
            return response.note;
        },
    });
    return (
        <Text as="span" variant="body">
            {isPending ? 'Loading template...' : isError ? 'Unable to load selected note' : data?.title || 'Untitled'}
        </Text>
    );
};

const TemplateSearch = ({ onSelect, onCancel }: { onSelect: (id: string) => void; onCancel: () => void }) => {
    const [search, setSearch] = useState('');
    const params = { query: search, limit: 10 };
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: queryKeys.notes.list(params),
        async queryFn() {
            const response = await fetchNotes(params);
            if (response.type === 'error') throw response;
            return response.allNotes;
        },
    });
    return (
        <div className="space-y-2 rounded-xl border border-border-subtle p-3">
            <Input
                aria-label="Search template notes"
                placeholder="Search notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
            />
            {isPending ? (
                <Text as="p" variant="meta">
                    Loading notes...
                </Text>
            ) : isError ? (
                <div role="alert">
                    <Text as="p" variant="meta">
                        Failed to load notes.
                    </Text>
                    <Button type="button" variant="subtle" size="sm" onClick={() => void refetch()}>
                        Retry
                    </Button>
                </div>
            ) : (
                <ul aria-label="Template notes" className="max-h-48 overflow-y-auto">
                    {data?.notes.map((note) => (
                        <li key={note.id}>
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => onSelect(note.id)}
                            >
                                {note.title || 'Untitled'}
                            </Button>
                        </li>
                    ))}
                    {!data?.notes.length ? (
                        <li>
                            <Text as="p" variant="meta">
                                No matching notes.
                            </Text>
                        </li>
                    ) : null}
                </ul>
            )}
            <Button type="button" variant="subtle" size="sm" onClick={onCancel}>
                Cancel selection
            </Button>
        </div>
    );
};

const ViewTemplatePicker = ({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) => {
    const [choosing, setChoosing] = useState(false);
    return (
        <div className="space-y-2">
            <Label size="md">Default template</Label>
            <div className="flex flex-wrap items-center gap-2">
                {value ? (
                    <TemplateTitle id={value} />
                ) : (
                    <Text as="span" variant="meta" tone="tertiary">
                        No template
                    </Text>
                )}
                <Button type="button" variant="subtle" size="sm" onClick={() => setChoosing(true)}>
                    {value ? 'Change template' : 'Choose template'}
                </Button>
                {value ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                        Clear template
                    </Button>
                ) : null}
            </div>
            {choosing ? (
                <TemplateSearch
                    onSelect={(id) => {
                        onChange(id);
                        setChoosing(false);
                    }}
                    onCancel={() => setChoosing(false)}
                />
            ) : null}
            <Text as="p" variant="meta" tone="tertiary">
                New notes inherit this note's outline and properties.
            </Text>
        </div>
    );
};

export default ViewTemplatePicker;
