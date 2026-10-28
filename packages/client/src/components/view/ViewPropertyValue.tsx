import classNames from 'classnames';
import * as Icon from '~/components/icon';
import type { NoteProperty } from '~/models/note.model';
import ViewChip from './ViewChip';

const ViewPropertyValue = ({ property }: { property?: NoteProperty }) => {
    if (!property) {
        return <span className="text-xs leading-5 text-fg-tertiary">—</span>;
    }

    if (property.valueType === 'select') {
        return (
            <ViewChip
                size="compact"
                className="max-w-full border-border-subtle bg-subtle/65 text-fg-secondary"
                truncateContent={false}
            >
                <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                        className="size-2 shrink-0 rounded-full border border-black/5"
                        style={{ backgroundColor: property.option?.color ?? 'var(--color-fg-tertiary)' }}
                        aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">{property.option?.label ?? property.value}</span>
                </span>
            </ViewChip>
        );
    }

    if (property.valueType === 'boolean') {
        const isTrue = property.value === 'true';
        const BooleanIcon = isTrue ? Icon.CheckCircle : Icon.Circle;

        return (
            <span className="inline-flex items-center gap-1.5 text-sm text-fg-secondary">
                <BooleanIcon className="size-3.5 text-fg-tertiary" weight={isTrue ? 'fill' : 'regular'} />
                {isTrue ? 'True' : 'False'}
            </span>
        );
    }

    return (
        <span
            className={classNames(
                'block truncate text-sm text-fg-secondary',
                property.valueType === 'number' && 'tabular-nums',
            )}
            title={property.value}
        >
            {property.value || '—'}
        </span>
    );
};

export default ViewPropertyValue;
