import { useId } from 'react';
import type { IntegrationPermission } from '~/apis/integration.api';
import { Checkbox, Label, Text } from '~/components/ui';

const labels: Record<IntegrationPermission, string> = {
    'notes:read': 'Read notes',
    'notes:create': 'Create notes',
    'notes:update': 'Edit notes',
    'notes:delete': 'Delete notes',
};

export default function IntegrationPermissions({
    requested,
    granted,
    disabled,
    onChange,
}: {
    requested: IntegrationPermission[];
    granted: IntegrationPermission[];
    disabled?: boolean;
    onChange: (permissions: IntegrationPermission[]) => void;
}) {
    const id = useId();
    return (
        <fieldset disabled={disabled} className="min-w-0">
            <legend className="mb-3 text-label font-medium text-fg-secondary">Allowed access</legend>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {requested.map((permission) => (
                    <div className="flex min-h-11 items-center gap-2" key={permission}>
                        <Checkbox
                            id={`${id}-${permission}`}
                            checked={granted.includes(permission)}
                            disabled={disabled}
                            onChange={(event) => {
                                const next = event.target.checked
                                    ? [...new Set([...granted, 'notes:read' as const, permission])]
                                    : permission === 'notes:read'
                                      ? []
                                      : granted.filter((item) => item !== permission);
                                onChange(next);
                            }}
                        />
                        <Label
                            htmlFor={`${id}-${permission}`}
                            className="flex min-h-11 flex-1 cursor-pointer items-center font-normal text-fg-default"
                        >
                            {labels[permission]}
                        </Label>
                    </div>
                ))}
            </div>
            <Text as="p" variant="meta" tone="secondary" className="mt-3">
                Only permissions requested by this app are shown. Reading includes all notes, tags, properties, and
                views. Write access also requires reading.
            </Text>
        </fieldset>
    );
}
