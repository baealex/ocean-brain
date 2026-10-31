import type { NoteProperty } from '~/models/note.model';
import ViewChip from './ViewChip';

export const formatViewPropertyChipValue = (property: NoteProperty) => {
    if (property.valueType === 'select') {
        return property.option?.label ?? property.value;
    }

    if (property.valueType === 'boolean') {
        return property.value === 'true' ? 'True' : 'False';
    }

    return property.value;
};

const ViewPropertyChip = ({ property }: { property: NoteProperty }) => {
    const value = formatViewPropertyChipValue(property) || '—';

    return (
        <ViewChip
            size="compact"
            truncateContent={false}
            className="max-w-[220px] gap-1.5 border-border-subtle bg-subtle/55 text-fg-secondary"
            title={`${property.name}: ${value}`}
        >
            {property.valueType === 'select' ? (
                <span
                    className="size-2 shrink-0 rounded-full border border-black/5"
                    style={{ backgroundColor: property.option?.color ?? 'var(--color-fg-tertiary)' }}
                    aria-hidden="true"
                />
            ) : null}
            <span className="max-w-[72px] shrink truncate text-fg-tertiary">{property.name}</span>
            <span className="min-w-0 truncate">{value}</span>
        </ViewChip>
    );
};

export default ViewPropertyChip;
