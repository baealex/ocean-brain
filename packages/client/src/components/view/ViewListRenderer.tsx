import { Link } from '@tanstack/react-router';
import classNames from 'classnames';

import * as Icon from '~/components/icon';
import { Button, Text } from '~/components/ui';
import type { Note, NoteProperty } from '~/models/note.model';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE } from '~/modules/url';
import ViewChip from './ViewChip';

interface ViewListRendererProps {
    compact?: boolean;
    notes: Note[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
}

const viewPreviewRowClassName =
    'focus-ring-soft group flex items-center justify-between gap-3 outline-none transition-colors hover:bg-hover-subtle focus-visible:bg-hover-subtle';

const formatPropertyValue = (property: NoteProperty) => {
    if (property.valueType === 'select') {
        return property.option?.label ?? property.value;
    }

    if (property.valueType === 'boolean') {
        return property.value === 'true' ? 'True' : 'False';
    }

    return property.value;
};

const renderTagSummary = (note: Note) => {
    const visibleTags = note.tags.slice(0, 2);
    const hiddenTagCount = note.tags.length - visibleTags.length;

    if (visibleTags.length === 0) {
        return null;
    }

    return (
        <>
            {visibleTags.map((tag) => (
                <ViewChip
                    key={tag.id}
                    size="compact"
                    className="max-w-[116px] shrink-0 border-border-subtle bg-transparent text-fg-secondary"
                >
                    {tag.name}
                </ViewChip>
            ))}
            {hiddenTagCount > 0 && (
                <ViewChip size="compact" className="shrink-0 border-border-subtle bg-subtle text-fg-tertiary">
                    +{hiddenTagCount}
                </ViewChip>
            )}
        </>
    );
};

const renderPropertySummary = (note: Note) => {
    const properties = note.properties ?? [];
    const visibleProperties = properties.slice(0, 2);
    const hiddenPropertyCount = properties.length - visibleProperties.length;

    if (visibleProperties.length === 0) {
        return null;
    }

    return (
        <>
            {visibleProperties.map((property) => (
                <ViewChip
                    key={property.key}
                    size="compact"
                    truncateContent={false}
                    className="max-w-[220px] gap-1.5 border-border-subtle bg-subtle/55 text-fg-secondary"
                >
                    {property.valueType === 'select' ? (
                        <span
                            className="size-2 shrink-0 rounded-full border border-black/5"
                            style={{ backgroundColor: property.option?.color ?? 'var(--color-fg-tertiary)' }}
                            aria-hidden="true"
                        />
                    ) : null}
                    <span className="max-w-[72px] shrink truncate text-fg-tertiary">{property.name}</span>
                    <span className="min-w-0 truncate">{formatPropertyValue(property) || '—'}</span>
                </ViewChip>
            ))}
            {hiddenPropertyCount > 0 ? (
                <ViewChip size="compact" className="shrink-0 border-border-subtle bg-subtle text-fg-tertiary">
                    +{hiddenPropertyCount} properties
                </ViewChip>
            ) : null}
        </>
    );
};

const ViewListRenderer = ({ notes, isPending, isError, onRetry, compact = false }: ViewListRendererProps) => {
    if (isPending) {
        return (
            <div className="overflow-hidden bg-transparent">
                <div className="h-[72px] animate-pulse bg-subtle/35" />
                <div className="h-[72px] animate-pulse border-t border-border-subtle/70 bg-subtle/35" />
                <div className="h-[72px] animate-pulse border-t border-border-subtle/70 bg-subtle/35" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className={compact ? 'px-2 py-3' : 'rounded-[16px] border border-border-subtle bg-subtle/30 p-4'}>
                <Text as="p" variant="body" weight="semibold">
                    Failed to load this view
                </Text>
                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                    Retry to refresh this saved query.
                </Text>
                <div className="mt-3">
                    <Button type="button" variant="subtle" size="sm" onClick={onRetry}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div
                className={compact ? 'px-2 py-3' : 'rounded-[16px] border border-dashed border-border-subtle px-4 py-5'}
            >
                <Text as="p" variant="body" weight="semibold">
                    No notes match yet
                </Text>
                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                    Add matching notes, or edit this view query.
                </Text>
            </div>
        );
    }

    return (
        <div className="divide-y divide-border-subtle/70 bg-transparent">
            {notes.map((note) => (
                <Link
                    key={note.id}
                    to={NOTE_ROUTE}
                    params={{ id: note.id }}
                    className={classNames(
                        viewPreviewRowClassName,
                        compact ? 'min-h-10 px-2 py-2' : 'min-h-[72px] px-4 py-3',
                    )}
                >
                    <div className={classNames('min-w-0 flex-1', compact && 'flex items-center gap-3')}>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Icon.FileNote className="size-4 shrink-0 text-fg-secondary" aria-hidden="true" />
                            {note.pinned ? (
                                <Icon.Pin
                                    className="size-3.5 shrink-0 text-fg-tertiary"
                                    weight="fill"
                                    aria-label="Pinned"
                                />
                            ) : null}
                            <Text
                                as="div"
                                variant="body"
                                weight={compact ? 'medium' : 'semibold'}
                                tracking="tight"
                                className="line-clamp-1"
                            >
                                {note.title || 'Untitled'}
                            </Text>
                        </div>
                        <div
                            className={
                                compact
                                    ? 'hidden min-w-0 items-center gap-1.5 sm:flex'
                                    : 'mt-2 flex min-w-0 flex-wrap items-center gap-1.5'
                            }
                        >
                            {renderPropertySummary(note)}
                            {renderTagSummary(note)}
                            <Text as="span" variant="label" weight="medium" tone="tertiary" className="sm:hidden">
                                Updated {timeSince(Number(note.updatedAt))}
                            </Text>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pl-2">
                        <Text as="span" variant="label" weight="medium" tone="tertiary" className="hidden sm:inline">
                            {timeSince(Number(note.updatedAt))}
                        </Text>
                        <Icon.ArrowRight className="size-4 text-fg-tertiary transition-transform group-hover:translate-x-0.5" />
                    </div>
                </Link>
            ))}
        </div>
    );
};

export default ViewListRenderer;
