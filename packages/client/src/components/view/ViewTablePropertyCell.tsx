import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { fetchNote, type NotePropertyKeySummary, updateNoteProperties } from '~/apis/note.api';
import * as Icon from '~/components/icon';
import { Button, Checkbox, Input, Select, SelectItem } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { compareNoteVersions } from '~/modules/note-version';
import { queryKeys } from '~/modules/query-key-factory';
import { invalidateQueriesForNoteChange } from '~/modules/server-event-invalidation';
import ViewPropertyValue from './ViewPropertyValue';

interface ViewTablePropertyCellProps {
    note: Note;
    definition: NotePropertyKeySummary;
}

const ViewTablePropertyCell = ({ note, definition }: ViewTablePropertyCellProps) => {
    const queryClient = useQueryClient();
    const [saved, setSaved] = useState<Pick<Note, 'updatedAt' | 'properties'> | null>(null);
    const [draft, setDraft] = useState<{ value: string; updatedAt: string } | null>(null);
    const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const restoreFocus = useRef(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const current = saved && compareNoteVersions(saved.updatedAt, note.updatedAt) === 1 ? saved : note;
    const property = current.properties?.find((property) => property.key === definition.key);
    const emptyValue = definition.valueType === 'boolean' ? 'false' : '';
    const isEditing = draft !== null;

    useEffect(() => {
        if (pending) return;
        if (isEditing) input.current?.focus();
        else if (restoreFocus.current) {
            trigger.current?.focus();
            restoreFocus.current = false;
        }
    }, [isEditing, pending]);

    const close = () => {
        restoreFocus.current = true;
        setDraft(null);
        setError(null);
    };

    const save = async (value: string | null) => {
        if (!draft || busy.current || error?.conflict) return;
        busy.current = true;
        setPending(true);
        setError(null);
        try {
            const response = await updateNoteProperties({
                id: note.id,
                expectedUpdatedAt: draft.updatedAt,
                ...(value === null
                    ? { deleteKeys: [definition.key] }
                    : { set: [{ key: definition.key, valueType: definition.valueType, value }] }),
            });
            if (response.type === 'error') {
                setError({
                    message: response.errors[0]?.message ?? 'Could not save this value.',
                    conflict: response.errors.some((error) => error.code === 'NOTE_UPDATE_CONFLICT'),
                });
                return;
            }
            setSaved(response.updateNoteProperties);
            close();
        } catch {
            setError({ message: 'Could not save this value. Try again.', conflict: false });
            return;
        } finally {
            busy.current = false;
            setPending(false);
        }
        await Promise.all([
            invalidateQueriesForNoteChange(queryClient),
            queryClient.invalidateQueries({ queryKey: queryKeys.notes.propertyKeysAll(), exact: false }),
        ]);
    };

    const reload = async () => {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        try {
            const response = await fetchNote(note.id);
            if (response.type === 'error') {
                setError({ message: response.errors[0]?.message ?? 'Could not reload this value.', conflict: true });
                return;
            }
            setSaved(response.note);
            setDraft({
                value:
                    response.note.properties?.find((property) => property.key === definition.key)?.value ?? emptyValue,
                updatedAt: response.note.updatedAt,
            });
            setError(null);
        } catch {
            setError({ message: 'Could not reload this value. Try again.', conflict: true });
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    if (!draft) {
        return (
            <button
                ref={trigger}
                type="button"
                aria-label={`Edit ${definition.name} for ${note.title || 'Untitled'}`}
                title={`Edit ${definition.name}`}
                className="focus-ring-soft flex min-h-6 w-full min-w-0 cursor-pointer items-center rounded-[6px] px-1 text-left outline-none transition-colors hover:bg-hover-subtle"
                disabled={pending}
                onClick={() => setDraft({ value: property?.value ?? emptyValue, updatedAt: current.updatedAt })}
            >
                <ViewPropertyValue property={property} />
            </button>
        );
    }

    return (
        <form
            className="flex min-w-0 flex-col gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                void save(draft.value === '' && definition.valueType !== 'text' ? null : draft.value);
            }}
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Escape' && !pending) {
                    event.preventDefault();
                    close();
                }
            }}
        >
            {definition.valueType === 'select' ? (
                <Select
                    size="sm"
                    defaultOpen
                    ariaLabel={`${definition.name} value`}
                    placeholder="Choose value"
                    value={draft.value}
                    disabled={pending || error?.conflict}
                    onValueChange={(value) => {
                        setDraft({ ...draft, value });
                        void save(value);
                    }}
                >
                    {definition.options.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </Select>
            ) : definition.valueType === 'boolean' ? (
                <div className="flex items-center gap-2 text-sm text-fg-secondary">
                    <Checkbox
                        ref={input}
                        aria-label={`${definition.name} value`}
                        checked={draft.value === 'true'}
                        disabled={pending}
                        onChange={(event) => setDraft({ ...draft, value: String(event.target.checked) })}
                    />
                    {draft.value === 'true' ? 'True' : 'False'}
                </div>
            ) : (
                <Input
                    ref={input}
                    size="sm"
                    type={definition.valueType === 'text' ? 'text' : definition.valueType}
                    step={definition.valueType === 'number' ? 'any' : undefined}
                    aria-label={`${definition.name} value`}
                    value={draft.value}
                    disabled={pending}
                    onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                />
            )}
            {error ? (
                <p role="alert" className="text-xs text-fg-error">
                    {error.message}
                </p>
            ) : null}
            {error?.conflict ? (
                <Button
                    type="button"
                    size="sm"
                    variant="subtle"
                    aria-label="Reload latest value"
                    disabled={pending}
                    onClick={() => void reload()}
                >
                    Reload value
                </Button>
            ) : null}
            <div className="flex flex-wrap items-center gap-1">
                <Button
                    type="submit"
                    size="sm"
                    variant="subtle"
                    disabled={pending || error?.conflict}
                    aria-label={`Save ${definition.name}`}
                >
                    Save
                </Button>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={pending}
                    aria-label={`Cancel ${definition.name} edit`}
                    title="Cancel"
                    onClick={close}
                >
                    <Icon.Close className="size-4" aria-hidden="true" />
                </Button>
                {property ? (
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={pending || error?.conflict}
                        aria-label={`Clear ${definition.name}`}
                        title={`Clear ${definition.name}`}
                        onClick={() => void save(null)}
                    >
                        <Icon.Eraser className="size-4" aria-hidden="true" />
                    </Button>
                ) : null}
            </div>
        </form>
    );
};

export default ViewTablePropertyCell;
