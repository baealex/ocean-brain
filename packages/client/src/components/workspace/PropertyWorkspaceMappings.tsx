import { Link } from '@tanstack/react-router';
import { Select, SelectItem, Text } from '~/components/ui';
import type { PropertyWorkspaceMapping, WorkspaceMovePreview } from '~/models/workspace.model';
import { SETTINGS_PROPERTIES_ROUTE } from '~/modules/url';

export const workspaceMappings = (
    preview: WorkspaceMovePreview,
    values: Record<string, string>,
): PropertyWorkspaceMapping[] =>
    preview.sourceProperties.map((property) => ({ sourceKey: property.key, targetKey: values[property.key] ?? '' }));

export const hasCompleteWorkspaceMappings = (
    preview: WorkspaceMovePreview,
    values: Record<string, string>,
): boolean => {
    const mappings = workspaceMappings(preview, values);
    return (
        new Set(mappings.map((mapping) => mapping.targetKey)).size === mappings.length &&
        preview.sourceProperties.every((property) => {
            const target = preview.targetProperties.find((target) => target.key === values[property.key]);
            return (
                target?.valueType === property.valueType &&
                (property.valueType !== 'select' || target.options.some((option) => option.value === property.value))
            );
        })
    );
};

export const PropertyWorkspaceMappings = ({
    preview,
    values,
    onChange,
}: {
    preview: WorkspaceMovePreview;
    values: Record<string, string>;
    onChange: (values: Record<string, string>) => void;
}) => {
    if (!preview.sourceProperties.length)
        return (
            <Text variant="meta" tone="secondary">
                This version has no fields to map. Its content and links will be preserved.
            </Text>
        );
    return (
        <div className="flex flex-col gap-3">
            <Text variant="meta" tone="secondary">
                Choose a field in {preview.targetWorkspace.name} for each value. Nothing is copied or discarded
                automatically.
            </Text>
            {preview.sourceProperties.map((property) => (
                <div key={property.key} className="flex flex-col gap-1.5">
                    <Text as="p" variant="meta">
                        {property.name}: {property.value}
                    </Text>
                    <Select
                        ariaLabel={`Destination field for ${property.name}`}
                        placeholder="Choose a destination field"
                        value={values[property.key] ?? ''}
                        onValueChange={(key) => onChange({ ...values, [property.key]: key })}
                    >
                        {preview.targetProperties
                            .filter(
                                (target) =>
                                    target.valueType === property.valueType &&
                                    (property.valueType !== 'select' ||
                                        target.options.some((option) => option.value === property.value)),
                            )
                            .map((target) => (
                                <SelectItem
                                    key={target.key}
                                    value={target.key}
                                    disabled={Object.entries(values).some(
                                        ([sourceKey, targetKey]) =>
                                            sourceKey !== property.key && targetKey === target.key,
                                    )}
                                >
                                    {target.name}
                                </SelectItem>
                            ))}
                    </Select>
                </div>
            ))}
            <Link
                to={SETTINGS_PROPERTIES_ROUTE}
                search={{ workspace: preview.targetWorkspace.id, page: 1 }}
                className="text-sm text-fg-secondary underline underline-offset-4"
            >
                Manage destination fields, then return to this note
            </Link>
        </div>
    );
};
