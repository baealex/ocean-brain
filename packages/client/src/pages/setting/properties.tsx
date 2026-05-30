import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import {
    createNotePropertyKey,
    deleteNotePropertyKey,
    fetchNotePropertyKeys,
    type NotePropertyKeySummary,
} from '~/apis/note.api';
import { Button, Modal, ModalActionRow, PageLayout } from '~/components/shared';
import { Input, Select, SelectItem, Text, useToast } from '~/components/ui';
import type { NotePropertyValueType } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_PROPERTIES_ROUTE } from '~/modules/url';

const Route = getRouteApi(SETTINGS_PROPERTIES_ROUTE);

const PROPERTY_TYPE_OPTIONS: { value: NotePropertyValueType; label: string; description: string }[] = [
    { value: 'text', label: 'Text', description: 'Short status or label values.' },
    { value: 'number', label: 'Number', description: 'Priority, score, or count values.' },
    { value: 'date', label: 'Date', description: 'Due dates and milestones.' },
    { value: 'boolean', label: 'Boolean', description: 'True or false flags.' },
    { value: 'select', label: 'Select', description: 'Choose one option from a controlled list.' },
];

export default function PropertiesSettings() {
    const toast = useToast();
    const queryClient = useQueryClient();
    const search = Route.useSearch() as { page?: number };
    const page = Number(search.page ?? 1);
    const limit = 50;
    const offset = Math.max(0, page - 1) * limit;
    const [key, setKey] = useState('');
    const [name, setName] = useState('');
    const [valueType, setValueType] = useState<NotePropertyValueType>('text');
    const [options, setOptions] = useState([{ label: '', value: '' }]);
    const [propertyToDelete, setPropertyToDelete] = useState<NotePropertyKeySummary | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const resetCreateForm = () => {
        setKey('');
        setName('');
        setValueType('text');
        setOptions([{ label: '', value: '' }]);
    };

    const propertyKeysQuery = useQuery({
        queryKey: queryKeys.notes.propertyKeys({ limit, offset }),
        queryFn: async () => {
            const response = await fetchNotePropertyKeys({ limit, offset });

            if (response.type === 'error') {
                throw response;
            }

            return response.notePropertyKeys;
        },
    });

    const createMutation = useMutation({
        mutationFn: async () =>
            createNotePropertyKey({
                key,
                name: name || key,
                valueType,
                ...(valueType === 'select'
                    ? {
                          options: options
                              .map((option, index) => ({
                                  label: option.label.trim(),
                                  value: option.value.trim() || option.label.trim(),
                                  order: index,
                              }))
                              .filter((option) => option.label),
                      }
                    : {}),
            }),
        onSuccess: (response) => {
            if (response.type === 'error') {
                toast(response.errors[0]?.message ?? 'Failed to create property.');
                return;
            }

            resetCreateForm();
            setIsCreateModalOpen(false);
            void queryClient.invalidateQueries({ queryKey: queryKeys.notes.propertyKeys() });
            toast('Property created.');
        },
        onError: () => {
            toast('Failed to create property.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async ({
            propertyKey,
            confirmImpact,
        }: {
            propertyKey: NotePropertyKeySummary;
            confirmImpact: boolean;
        }) =>
            deleteNotePropertyKey({
                key: propertyKey.key,
                confirmImpact,
            }),
        onSuccess: (response) => {
            if (response.type === 'error') {
                toast(response.errors[0]?.message ?? 'Failed to delete property.');
                return;
            }

            void queryClient.invalidateQueries({ queryKey: queryKeys.notes.all() });
            setPropertyToDelete(null);
            toast(
                response.deleteNotePropertyKey.affectedNoteCount > 0
                    ? `Property deleted from ${response.deleteNotePropertyKey.affectedNoteCount} note(s).`
                    : 'Property deleted.',
            );
        },
        onError: () => {
            toast('Failed to delete property.');
        },
    });

    const propertyKeys = propertyKeysQuery.data?.keys ?? [];
    const hasValidSelectOption = valueType !== 'select' || options.some((option) => option.label.trim());
    const handleConfirmDeleteProperty = () => {
        if (!propertyToDelete) return;

        deleteMutation.mutate({
            propertyKey: propertyToDelete,
            confirmImpact: propertyToDelete.noteCount > 0,
        });
    };

    return (
        <PageLayout
            title="Properties"
            description="Define shared note fields before using them in notes and future views."
            headerRight={
                <Button
                    type="button"
                    size="md"
                    variant="primary"
                    className="w-full sm:w-auto"
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    New property
                </Button>
            }
        >
            <section className="flex flex-col gap-3" aria-labelledby="shared-properties-heading">
                <div className="flex items-center justify-between gap-3">
                    <Text
                        id="shared-properties-heading"
                        as="h2"
                        variant="label"
                        weight="medium"
                        className="text-fg-tertiary"
                    >
                        Shared fields
                    </Text>
                    {!propertyKeysQuery.isLoading && propertyKeys.length > 0 && (
                        <Text as="span" variant="meta" tone="tertiary">
                            {propertyKeys.length} field{propertyKeys.length === 1 ? '' : 's'}
                        </Text>
                    )}
                </div>

                {propertyKeysQuery.isLoading ? (
                    <Text as="p" variant="body" tone="tertiary" className="surface-base px-4 py-3.5">
                        Loading properties...
                    </Text>
                ) : propertyKeys.length === 0 ? (
                    <div className="surface-base border-dashed p-6 text-center">
                        <Text as="p" variant="body" weight="medium">
                            No shared properties yet.
                        </Text>
                        <Text as="p" variant="label" tone="tertiary">
                            Create one here, then attach it from the note screen.
                        </Text>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {propertyKeys.map((propertyKey) => (
                            <article
                                key={propertyKey.key}
                                className="surface-base grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_120px_120px_auto] md:items-center"
                            >
                                <div className="min-w-0">
                                    <Text as="h3" variant="body" weight="semibold" className="truncate">
                                        {propertyKey.name}
                                    </Text>
                                    <Text as="p" variant="micro" tone="tertiary" className="font-mono">
                                        {propertyKey.key}
                                    </Text>
                                    {propertyKey.options.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {propertyKey.options.slice(0, 6).map((option) => (
                                                <span
                                                    key={option.id}
                                                    className="rounded-full border border-border-subtle bg-subtle px-2 py-0.5 text-xs font-medium text-fg-secondary"
                                                >
                                                    {option.label}
                                                </span>
                                            ))}
                                            {propertyKey.options.length > 6 && (
                                                <span className="rounded-full border border-border-subtle bg-subtle px-2 py-0.5 text-xs font-medium text-fg-tertiary">
                                                    +{propertyKey.options.length - 6}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <Text as="span" variant="micro" tone="tertiary" className="block md:hidden">
                                        Type
                                    </Text>
                                    <Text as="span" variant="label" tone="secondary" className="capitalize">
                                        {propertyKey.valueType}
                                    </Text>
                                </div>
                                <div className="min-w-0">
                                    <Text as="span" variant="micro" tone="tertiary" className="block md:hidden">
                                        Used in
                                    </Text>
                                    <Text as="span" variant="label" tone="tertiary">
                                        {propertyKey.noteCount} note{propertyKey.noteCount === 1 ? '' : 's'}
                                    </Text>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="soft-danger"
                                    className="justify-self-start md:justify-self-end"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => setPropertyToDelete(propertyKey)}
                                >
                                    Delete
                                </Button>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    if (!createMutation.isPending) {
                        setIsCreateModalOpen(false);
                        resetCreateForm();
                    }
                }}
                variant="form"
            >
                <Modal.Header
                    title="New property"
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        resetCreateForm();
                    }}
                />
                <Modal.Body>
                    <div className="flex flex-col gap-3">
                        <Text as="p" variant="label" tone="tertiary">
                            Create a shared field that notes can use for values and future views.
                        </Text>
                        <label className="flex flex-col gap-1.5">
                            <Text as="span" variant="label" weight="medium">
                                Key
                            </Text>
                            <Input
                                size="md"
                                placeholder="status"
                                value={key}
                                onChange={(event) => setKey(event.target.value)}
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <Text as="span" variant="label" weight="medium">
                                Name
                            </Text>
                            <Input
                                size="md"
                                placeholder="Status"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <Text as="span" variant="label" weight="medium">
                                Type
                            </Text>
                            <Select
                                value={valueType}
                                onValueChange={(value) => setValueType(value as NotePropertyValueType)}
                            >
                                {PROPERTY_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </Select>
                        </label>
                        {valueType === 'select' && (
                            <div className="rounded-[14px] border border-border-subtle bg-subtle/50 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <Text as="span" variant="label" weight="semibold">
                                        Options
                                    </Text>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="subtle"
                                        onClick={() => setOptions((current) => [...current, { label: '', value: '' }])}
                                    >
                                        Add option
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {options.map((option, index) => (
                                        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                            <Input
                                                size="sm"
                                                placeholder="Label"
                                                value={option.label}
                                                onChange={(event) =>
                                                    setOptions((current) =>
                                                        current.map((item, itemIndex) =>
                                                            itemIndex === index
                                                                ? { ...item, label: event.target.value }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                            />
                                            <Input
                                                size="sm"
                                                placeholder="value"
                                                value={option.value}
                                                onChange={(event) =>
                                                    setOptions((current) =>
                                                        current.map((item, itemIndex) =>
                                                            itemIndex === index
                                                                ? { ...item, value: event.target.value }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="soft-danger"
                                                onClick={() =>
                                                    setOptions((current) =>
                                                        current.filter((_, itemIndex) => itemIndex !== index),
                                                    )
                                                }
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <Text as="p" variant="micro" tone="tertiary">
                            {PROPERTY_TYPE_OPTIONS.find((option) => option.value === valueType)?.description}
                        </Text>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <ModalActionRow>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={createMutation.isPending}
                            onClick={() => {
                                setIsCreateModalOpen(false);
                                resetCreateForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={!key.trim() || !hasValidSelectOption || createMutation.isPending}
                            isLoading={createMutation.isPending}
                            onClick={() => createMutation.mutate()}
                        >
                            Create property
                        </Button>
                    </ModalActionRow>
                </Modal.Footer>
            </Modal>

            <Modal
                isOpen={Boolean(propertyToDelete)}
                onClose={() => {
                    if (!deleteMutation.isPending) setPropertyToDelete(null);
                }}
                variant="confirm"
            >
                <Modal.Header title="Delete property" onClose={() => setPropertyToDelete(null)} />
                <Modal.Body>
                    {propertyToDelete && (
                        <div className="space-y-3">
                            <Text as="p" variant="body" weight="medium">
                                Delete “{propertyToDelete.name}”?
                            </Text>
                            {propertyToDelete.noteCount > 0 ? (
                                <div className="rounded-[14px] border border-border-subtle bg-subtle p-3">
                                    <Text as="p" variant="label" tone="secondary">
                                        This property is used by {propertyToDelete.noteCount} note
                                        {propertyToDelete.noteCount === 1 ? '' : 's'}.
                                    </Text>
                                    <Text as="p" variant="micro" tone="tertiary" className="mt-1 leading-5">
                                        Deleting it removes this value from those notes. Future views using this
                                        property will need configuration.
                                    </Text>
                                </div>
                            ) : (
                                <Text as="p" variant="label" tone="tertiary">
                                    This property is not used by any note yet.
                                </Text>
                            )}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <ModalActionRow>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => setPropertyToDelete(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            isLoading={deleteMutation.isPending}
                            onClick={handleConfirmDeleteProperty}
                        >
                            Delete
                        </Button>
                    </ModalActionRow>
                </Modal.Footer>
            </Modal>
        </PageLayout>
    );
}
