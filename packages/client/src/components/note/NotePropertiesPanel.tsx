import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    fetchNotePropertyKeys,
    type NotePropertyKeySummary,
    type UpdateNotePropertiesRequestData,
    updateNoteProperties,
} from '~/apis/note.api';
import * as Icon from '~/components/icon';
import { AuxiliaryPanel, Button } from '~/components/shared';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Input,
    Select,
    SelectItem,
    Text,
    useToast,
} from '~/components/ui';
import type { Note, NoteProperty, NotePropertyValueType } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_PROPERTIES_ROUTE } from '~/modules/url';

const getSafeExternalUrl = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return null;
    }

    try {
        const url = new URL(trimmedValue);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
};

interface EditableNotePropertyRow {
    id: string;
    key: string;
    name: string;
    value: string;
    valueType: NotePropertyValueType;
    persistedKey?: string;
}

const createEditablePropertyRow = (property?: NoteProperty): EditableNotePropertyRow => ({
    id: property?.key ?? '',
    key: property?.key ?? '',
    name: property?.name ?? '',
    value: property?.value ?? '',
    valueType: property?.valueType ?? 'text',
    persistedKey: property?.key,
});

const normalizePropertyKeySummaries = (value: unknown): NotePropertyKeySummary[] => {
    if (Array.isArray(value)) {
        return value as NotePropertyKeySummary[];
    }

    const keys = (value as { keys?: unknown })?.keys;

    return Array.isArray(keys) ? (keys as NotePropertyKeySummary[]) : [];
};

interface NotePropertiesPatchDraft {
    set: {
        key: string;
        name: string;
        value: string;
        valueType: NotePropertyValueType;
    }[];
    deleteKeys: string[];
}

const getNormalizedRows = (properties: NoteProperty[] = []) => properties.map(createEditablePropertyRow);

const getPropertyRowsPatchDraft = (
    rows: EditableNotePropertyRow[],
    deletedKeys: string[],
): NotePropertiesPatchDraft => {
    const set: NotePropertiesPatchDraft['set'] = [];
    const deleteKeySet = new Set(deletedKeys);

    for (const row of rows) {
        const key = row.key.trim();

        if (!key) {
            continue;
        }

        const value = row.value.trim();
        const shouldDeleteBlankPersistedValue =
            Boolean(row.persistedKey) &&
            (row.valueType === 'number' ||
                row.valueType === 'date' ||
                row.valueType === 'select' ||
                row.valueType === 'url');

        if (!value && shouldDeleteBlankPersistedValue) {
            deleteKeySet.add(row.persistedKey as string);
            continue;
        }

        if (!value && row.valueType !== 'text' && row.valueType !== 'boolean') {
            continue;
        }

        set.push({
            key,
            name: row.name.trim() || key,
            value: row.valueType === 'boolean' ? value || 'false' : value,
            valueType: row.valueType,
        });
    }

    return {
        set: set.sort((left, right) => left.key.localeCompare(right.key)),
        deleteKeys: Array.from(deleteKeySet).sort(),
    };
};

const getPropertyRowsPatchSignature = (rows: EditableNotePropertyRow[], deletedKeys: string[] = []) =>
    JSON.stringify(getPropertyRowsPatchDraft(rows, deletedKeys));

export type NotePropertySaveResult = 'idle' | 'saved' | 'error';

export interface NotePropertiesPanelRef {
    flushPendingSave: (options?: { expectedUpdatedAt?: string }) => Promise<NotePropertySaveResult>;
    invalidateInFlightSave: () => void;
    discardPendingChanges: () => void;
}

interface NotePropertiesPanelProps {
    noteId: string;
    properties?: NoteProperty[];
    expectedUpdatedAt: string;
    editSessionId: string;
    disabled?: boolean;
    saveProperties?: (
        input: UpdateNotePropertiesRequestData,
    ) => Promise<Awaited<ReturnType<typeof updateNoteProperties>> | undefined>;
    onPendingChange?: (hasPendingChanges: boolean) => void;
    onSaved: (note: Pick<Note, 'id' | 'updatedAt' | 'properties'>) => void | Promise<void>;
}

const NotePropertiesPanel = forwardRef<NotePropertiesPanelRef, NotePropertiesPanelProps>(function NotePropertiesPanel(
    {
        noteId,
        properties = [],
        expectedUpdatedAt,
        editSessionId,
        disabled,
        saveProperties = updateNoteProperties,
        onPendingChange,
        onSaved,
    },
    ref,
) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [rows, setRows] = useState<EditableNotePropertyRow[]>(() => getNormalizedRows(properties));
    const [deletedKeys, setDeletedKeys] = useState<string[]>([]);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const rowsRef = useRef(rows);
    const deletedKeysRef = useRef(deletedKeys);
    const expectedUpdatedAtRef = useRef(expectedUpdatedAt);
    const savedSignatureRef = useRef(getPropertyRowsPatchSignature(rows));
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isAutoSavingRef = useRef(false);
    const inFlightSavePromiseRef = useRef<Promise<NotePropertySaveResult> | null>(null);
    const hasQueuedAutoSaveRef = useRef(false);
    const saveGenerationRef = useRef(0);

    const propertyKeysQuery = useQuery({
        queryKey: queryKeys.notes.propertyKeys({ limit: 50 }),
        queryFn: async () => {
            const response = await fetchNotePropertyKeys({ limit: 50 });

            if (response.type === 'error') {
                throw response;
            }

            return response.notePropertyKeys.keys;
        },
    });

    useEffect(() => {
        const nextRows = getNormalizedRows(properties);

        setRows(nextRows);
        setDeletedKeys([]);
        savedSignatureRef.current = getPropertyRowsPatchSignature(nextRows);
        setAutoSaveStatus('idle');
    }, [properties]);

    useEffect(() => {
        rowsRef.current = rows;
    }, [rows]);

    useEffect(() => {
        deletedKeysRef.current = deletedKeys;
    }, [deletedKeys]);

    useEffect(() => {
        expectedUpdatedAtRef.current = expectedUpdatedAt;
    }, [expectedUpdatedAt]);

    const propertyKeySummaries = normalizePropertyKeySummaries(propertyKeysQuery.data);
    const visiblePropertyKeys = propertyKeySummaries.filter(
        (propertyKey) => !rows.some((row) => row.key === propertyKey.key),
    );
    const hasPropertyDefinitions = propertyKeySummaries.length > 0;
    const hasPendingChanges = getPropertyRowsPatchSignature(rows, deletedKeys) !== savedSignatureRef.current;

    const saveCurrentRows = useCallback(
        async ({
            ignoreDisabled = false,
            expectedUpdatedAt: expectedUpdatedAtOverride,
        }: {
            ignoreDisabled?: boolean;
            expectedUpdatedAt?: string;
        } = {}): Promise<NotePropertySaveResult> => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }

            if (inFlightSavePromiseRef.current) {
                hasQueuedAutoSaveRef.current = true;
                const result = await inFlightSavePromiseRef.current;

                if (result === 'error') {
                    return result;
                }

                return saveCurrentRows({ ignoreDisabled });
            }

            const signature = getPropertyRowsPatchSignature(rowsRef.current, deletedKeysRef.current);

            if ((!ignoreDisabled && disabled) || signature === savedSignatureRef.current) {
                return 'idle';
            }

            const patch = getPropertyRowsPatchDraft(rowsRef.current, deletedKeysRef.current);

            if (patch.set.length === 0 && patch.deleteKeys.length === 0) {
                return 'idle';
            }

            isAutoSavingRef.current = true;
            hasQueuedAutoSaveRef.current = false;
            setAutoSaveStatus('saving');
            const saveGeneration = saveGenerationRef.current;

            const savePromise = (async (): Promise<NotePropertySaveResult> => {
                try {
                    const response = await saveProperties({
                        id: noteId,
                        set: patch.set,
                        deleteKeys: patch.deleteKeys,
                        editSessionId,
                        expectedUpdatedAt: expectedUpdatedAtOverride ?? expectedUpdatedAtRef.current,
                    });

                    if (!response || saveGeneration !== saveGenerationRef.current) {
                        setAutoSaveStatus('idle');
                        return 'idle';
                    }

                    if (response.type === 'error') {
                        setAutoSaveStatus('error');
                        toast(response.errors[0]?.message ?? 'Failed to save properties.');
                        return 'error';
                    }

                    expectedUpdatedAtRef.current = response.updateNoteProperties.updatedAt;
                    savedSignatureRef.current = getPropertyRowsPatchSignature(
                        getNormalizedRows(response.updateNoteProperties.properties ?? []),
                    );
                    await onSaved(response.updateNoteProperties);
                    void queryClient.invalidateQueries({ queryKey: queryKeys.notes.propertyKeysAll(), exact: false });
                    setAutoSaveStatus('saved');
                    return 'saved';
                } catch {
                    setAutoSaveStatus('error');
                    toast('Failed to save properties.');
                    return 'error';
                } finally {
                    isAutoSavingRef.current = false;
                }
            })();

            inFlightSavePromiseRef.current = savePromise;
            const result = await savePromise;

            if (inFlightSavePromiseRef.current === savePromise) {
                inFlightSavePromiseRef.current = null;
            }

            if (hasQueuedAutoSaveRef.current) {
                hasQueuedAutoSaveRef.current = false;
                const queuedResult = await saveCurrentRows({
                    ignoreDisabled,
                });

                return queuedResult === 'idle' ? result : queuedResult;
            }

            return result;
        },
        [disabled, editSessionId, noteId, onSaved, queryClient, saveProperties, toast],
    );

    useImperativeHandle(
        ref,
        () => ({
            flushPendingSave: ({ expectedUpdatedAt: nextExpectedUpdatedAt } = {}) =>
                saveCurrentRows({ ignoreDisabled: true, expectedUpdatedAt: nextExpectedUpdatedAt }),
            invalidateInFlightSave: () => {
                saveGenerationRef.current += 1;

                if (autoSaveTimerRef.current) {
                    clearTimeout(autoSaveTimerRef.current);
                    autoSaveTimerRef.current = null;
                }
            },
            discardPendingChanges: () => {
                saveGenerationRef.current += 1;
                hasQueuedAutoSaveRef.current = false;
                savedSignatureRef.current = getPropertyRowsPatchSignature(rowsRef.current, deletedKeysRef.current);
                setAutoSaveStatus('idle');

                if (autoSaveTimerRef.current) {
                    clearTimeout(autoSaveTimerRef.current);
                    autoSaveTimerRef.current = null;
                }
            },
        }),
        [saveCurrentRows],
    );

    useEffect(() => {
        onPendingChange?.(hasPendingChanges || autoSaveStatus === 'saving');
    }, [autoSaveStatus, hasPendingChanges, onPendingChange]);

    useEffect(() => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        if (disabled || getPropertyRowsPatchSignature(rows, deletedKeys) === savedSignatureRef.current) {
            return;
        }

        autoSaveTimerRef.current = setTimeout(() => {
            void saveCurrentRows();
        }, 500);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [deletedKeys, disabled, rows, saveCurrentRows]);

    const addKnownProperty = (propertyKey: NotePropertyKeySummary) => {
        setRows((current) => [
            ...current,
            {
                id: propertyKey.key,
                key: propertyKey.key,
                name: propertyKey.name,
                value: '',
                valueType: propertyKey.valueType,
                persistedKey: undefined,
            },
        ]);
        setDeletedKeys((current) => current.filter((key) => key !== propertyKey.key));
    };

    const updateRow = (rowId: string, patch: Partial<EditableNotePropertyRow>) => {
        setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
    };

    const removeRow = (row: EditableNotePropertyRow) => {
        if (row.persistedKey) {
            setDeletedKeys((current) => [...new Set([...current, row.persistedKey as string])]);
        }

        setRows((current) => current.filter((item) => item.id !== row.id));
    };

    const hasChanges = getPropertyRowsPatchSignature(rows, deletedKeys) !== savedSignatureRef.current;
    const saveStatusText =
        disabled || (!hasChanges && autoSaveStatus === 'idle')
            ? null
            : autoSaveStatus === 'saving'
              ? 'Saving...'
              : autoSaveStatus === 'error'
                ? 'Save failed'
                : hasChanges
                  ? 'Waiting...'
                  : 'Saved';

    return (
        <AuxiliaryPanel
            title="Properties"
            icon={<Icon.Tag className="h-3.5 w-3.5" />}
            ariaLabel="Note properties"
            action={
                <>
                    {saveStatusText && (
                        <Text
                            as="span"
                            variant="micro"
                            tone={autoSaveStatus === 'error' ? 'error' : 'tertiary'}
                            className="px-1"
                        >
                            {saveStatusText}
                        </Text>
                    )}
                    {hasPropertyDefinitions && (
                        <Button asChild size="sm" variant="ghost">
                            <Link to={SETTINGS_PROPERTIES_ROUTE} search={{ page: 1 }}>
                                <Icon.Gear className="h-3 w-3" />
                                Manage
                            </Link>
                        </Button>
                    )}
                </>
            }
        >
            {rows.length === 0 ? (
                <Text as="p" variant="label" tone="tertiary" className="px-1 py-2">
                    No properties yet.
                </Text>
            ) : (
                <div className="divide-y divide-border-subtle">
                    {rows.map((row) => {
                        const propertyLabelId = `note-property-${row.id}-label`;
                        const safeExternalUrl = row.valueType === 'url' ? getSafeExternalUrl(row.value) : null;

                        return (
                            <div
                                key={row.id}
                                className="group grid gap-2 py-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-center"
                            >
                                <div className="flex min-w-0 items-center gap-2 px-1">
                                    <Text
                                        id={propertyLabelId}
                                        as="span"
                                        variant="label"
                                        tone="secondary"
                                        className="truncate"
                                    >
                                        {row.name}
                                    </Text>
                                    <Text
                                        as="span"
                                        variant="micro"
                                        tone="tertiary"
                                        className="hidden truncate font-mono sm:inline"
                                    >
                                        {row.key}
                                    </Text>
                                </div>
                                {row.valueType === 'boolean' ? (
                                    <Select
                                        size="sm"
                                        variant="ghost"
                                        value={row.value || 'false'}
                                        disabled={disabled}
                                        aria-labelledby={propertyLabelId}
                                        onValueChange={(value) => updateRow(row.id, { value })}
                                    >
                                        <SelectItem value="false">False</SelectItem>
                                        <SelectItem value="true">True</SelectItem>
                                    </Select>
                                ) : row.valueType === 'select' ? (
                                    <Select
                                        size="sm"
                                        variant="ghost"
                                        value={row.value}
                                        placeholder="Select option"
                                        disabled={disabled}
                                        aria-labelledby={propertyLabelId}
                                        onValueChange={(value) => updateRow(row.id, { value })}
                                    >
                                        {(
                                            propertyKeySummaries.find((propertyKey) => propertyKey.key === row.key)
                                                ?.options ?? []
                                        ).map((option) => (
                                            <SelectItem key={option.id} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                ) : row.valueType === 'url' ? (
                                    <div className="flex min-w-0 items-center gap-1">
                                        <Input
                                            className="min-w-0"
                                            size="sm"
                                            variant="ghost"
                                            type="url"
                                            aria-label="Property value"
                                            placeholder="https://example.com"
                                            value={row.value}
                                            disabled={disabled}
                                            onChange={(event) => updateRow(row.id, { value: event.target.value })}
                                        />
                                        {safeExternalUrl ? (
                                            <Button
                                                asChild
                                                size="icon-sm"
                                                variant="ghost"
                                                aria-label={`Open ${row.name}`}
                                                className="shrink-0 text-fg-tertiary"
                                            >
                                                <a
                                                    href={safeExternalUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={safeExternalUrl}
                                                >
                                                    <Icon.LinkSimple className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : (
                                    <Input
                                        size="sm"
                                        variant="ghost"
                                        type={
                                            row.valueType === 'date'
                                                ? 'date'
                                                : row.valueType === 'number'
                                                  ? 'number'
                                                  : 'text'
                                        }
                                        aria-label="Property value"
                                        placeholder="Value"
                                        value={row.value}
                                        disabled={disabled}
                                        onChange={(event) => updateRow(row.id, { value: event.target.value })}
                                    />
                                )}
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={`Remove ${row.name}`}
                                    disabled={disabled}
                                    className="justify-self-end text-fg-tertiary sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                                    onClick={() => removeRow(row)}
                                >
                                    <Icon.Close className="h-4 w-4" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
                {propertyKeysQuery.isLoading ? (
                    <Button type="button" size="sm" variant="ghost" disabled>
                        Loading properties...
                    </Button>
                ) : visiblePropertyKeys.length > 0 ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" size="sm" variant="ghost" disabled={disabled}>
                                <Icon.Plus className="h-4 w-4" />
                                Add property
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            sideOffset={6}
                            className="max-h-80 w-[min(22rem,calc(100vw-2rem))]"
                            style={{ overflowY: 'auto' }}
                        >
                            <DropdownMenuLabel>
                                <Text as="span" variant="label" weight="semibold">
                                    Add property
                                </Text>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {visiblePropertyKeys.map((propertyKey) => (
                                <DropdownMenuItem
                                    key={propertyKey.key}
                                    className="flex-col items-start gap-0.5 whitespace-normal"
                                    onClick={() => addKnownProperty(propertyKey)}
                                >
                                    <span className="flex w-full min-w-0 items-center justify-between gap-3">
                                        <Text as="span" variant="label" weight="medium" className="truncate">
                                            {propertyKey.name}
                                        </Text>
                                        <Text as="span" variant="micro" tone="tertiary" className="shrink-0 capitalize">
                                            {propertyKey.valueType}
                                        </Text>
                                    </span>
                                    <Text as="span" variant="micro" tone="tertiary" className="font-mono">
                                        {propertyKey.key}
                                    </Text>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : hasPropertyDefinitions ? (
                    <Text as="span" variant="micro" tone="tertiary" className="px-1">
                        All shared properties are attached.
                    </Text>
                ) : (
                    <Link
                        to={SETTINGS_PROPERTIES_ROUTE}
                        search={{ page: 1 }}
                        className="focus-ring-soft inline-flex items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-sm font-medium text-fg-secondary outline-none hover:bg-hover-subtle hover:text-fg-default"
                    >
                        <Icon.Plus className="h-4 w-4" />
                        Create property definition
                    </Link>
                )}
            </div>
        </AuxiliaryPanel>
    );
});

export default NotePropertiesPanel;
