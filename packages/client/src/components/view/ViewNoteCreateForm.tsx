import { useId, useState } from 'react';
import type { ViewNoteInput } from '~/apis/view.api';
import { ModalActionRow } from '~/components/shared';
import { Button, Checkbox, Input, Label, Modal, Select, SelectItem, Text } from '~/components/ui';
import type { ViewNoteCreationContext } from '~/models/view.model';
import { formatViewPropertyFilter } from '~/modules/view-dashboard';

type CreationProperty = ViewNoteCreationContext['properties'][number];

const PropertyInput = ({
    id,
    property,
    value,
    disabled,
    onChange,
}: {
    id: string;
    property: CreationProperty;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}) => {
    if (property.valueType === 'select' || property.valueType === 'boolean') {
        const options =
            property.valueType === 'boolean'
                ? [
                      { value: 'true', label: 'True' },
                      { value: 'false', label: 'False' },
                  ]
                : property.options;
        return (
            <Select id={id} value={value} placeholder="Choose a value" disabled={disabled} onValueChange={onChange}>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </Select>
        );
    }

    return (
        <Input
            id={id}
            type={property.valueType}
            step={property.valueType === 'number' ? 'any' : undefined}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
        />
    );
};

const ViewNoteCreateForm = ({
    context,
    pending,
    error,
    onSubmit,
    onClose,
}: {
    context: ViewNoteCreationContext;
    pending: boolean;
    error?: string;
    onSubmit: (input: ViewNoteInput) => void;
    onClose: () => void;
}) => {
    const formId = useId();
    const [title, setTitle] = useState('');
    const [selectedTags, setTagNames] = useState<string[] | null>(null);
    const [overrides, setValues] = useState<Record<string, string>>({});
    const tagNames = selectedTags?.filter((name) => context.tagNames.includes(name)) ?? context.defaultTagNames;
    const values = Object.fromEntries(
        context.properties.map((property) => [property.key, overrides[property.key] ?? property.defaultValue ?? '']),
    );
    const needsTagChoice = context.mode === 'or' && context.tagNames.length > 1;
    const missingValue = context.properties.some(
        (property) => property.required && property.valueType !== 'text' && !values[property.key],
    );
    const canSubmit = !missingValue && (!needsTagChoice || tagNames.length);

    return (
        <>
            <Modal.Body>
                <form
                    id={formId}
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!canSubmit || pending) return;
                        const properties = context.properties
                            .filter((property) => property.required || values[property.key])
                            .map((property) => ({ key: property.key, value: values[property.key] ?? '' }));
                        const deletePropertyKeys = context.properties
                            .filter(
                                (property) =>
                                    !property.required &&
                                    !values[property.key] &&
                                    property.defaultValue !== null &&
                                    property.defaultValue !== '',
                            )
                            .map((property) => property.key);
                        onSubmit({
                            title,
                            tagNames,
                            ...(properties.length ? { properties } : {}),
                            ...(deletePropertyKeys.length ? { deletePropertyKeys } : {}),
                        });
                    }}
                >
                    <Text as="p" variant="meta" tone="tertiary">
                        Creating in {context.title}
                    </Text>
                    {context.templateNote ? (
                        <Text as="p" variant="meta" tone="tertiary">
                            Template: {context.templateNote.title}
                        </Text>
                    ) : null}
                    <div className="space-y-2">
                        <Label htmlFor={`${formId}-title`} size="md">
                            Title
                        </Label>
                        <Input
                            id={`${formId}-title`}
                            autoFocus
                            value={title}
                            placeholder="Untitled"
                            disabled={pending}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </div>
                    {needsTagChoice ? (
                        <fieldset className="space-y-2" disabled={pending}>
                            <legend className="mb-2 text-sm font-semibold">Choose at least one tag</legend>
                            {context.tagNames.map((tag, index) => (
                                <div key={tag} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`${formId}-tag-${index}`}
                                        checked={tagNames.includes(tag)}
                                        onChange={(event) =>
                                            setTagNames(
                                                event.target.checked
                                                    ? [...tagNames, tag]
                                                    : tagNames.filter((name) => name !== tag),
                                            )
                                        }
                                    />
                                    <Label htmlFor={`${formId}-tag-${index}`} size="md">
                                        {tag}
                                    </Label>
                                </div>
                            ))}
                        </fieldset>
                    ) : context.defaultTagNames.length ? (
                        <Text as="p" variant="meta">
                            Tags: {context.defaultTagNames.join(', ')}
                        </Text>
                    ) : null}
                    {context.properties.map((property) => {
                        const id = `${formId}-${property.key}`;
                        const value = values[property.key] ?? '';
                        return (
                            <div key={property.key} className="space-y-2">
                                <Label htmlFor={id} size="md">
                                    {property.name}
                                    {property.required ? ' *' : ''}
                                </Label>
                                <PropertyInput
                                    id={id}
                                    property={property}
                                    value={value}
                                    disabled={pending}
                                    onChange={(next) => setValues((current) => ({ ...current, [property.key]: next }))}
                                />
                                {!property.required && value ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="subtle"
                                        disabled={pending}
                                        onClick={() => setValues((current) => ({ ...current, [property.key]: '' }))}
                                    >
                                        Clear {property.name}
                                    </Button>
                                ) : null}
                                {property.filters.map((filter) => (
                                    <Text
                                        key={`${filter.operator}-${filter.value}`}
                                        as="p"
                                        variant="meta"
                                        tone="tertiary"
                                    >
                                        {formatViewPropertyFilter(filter)}
                                    </Text>
                                ))}
                            </div>
                        );
                    })}
                    {error ? (
                        <Text as="p" variant="meta" role="alert">
                            {error}
                        </Text>
                    ) : null}
                </form>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" form={formId} size="sm" disabled={!canSubmit || pending}>
                        {pending ? 'Creating...' : 'Create note'}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </>
    );
};

export default ViewNoteCreateForm;
