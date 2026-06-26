import { Link } from '@tanstack/react-router';

import * as Icon from '~/components/icon';
import { Button, Text } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE } from '~/modules/url';
import ViewChip from './ViewChip';

interface ViewSectionListRendererProps {
    notes: Note[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
}

const sectionPreviewRowClassName =
    'group flex min-h-[64px] items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-hover-subtle';

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

export default function ViewSectionListRenderer({ notes, isPending, isError, onRetry }: ViewSectionListRendererProps) {
    if (isPending) {
        return (
            <div className="overflow-hidden bg-transparent">
                <div className="h-[64px] animate-pulse bg-subtle/35" />
                <div className="h-[64px] animate-pulse border-t border-border-subtle/70 bg-subtle/35" />
                <div className="h-[64px] animate-pulse border-t border-border-subtle/70 bg-subtle/35" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-[16px] border border-border-subtle bg-subtle/30 p-4">
                <Text as="p" variant="body" weight="semibold">
                    Failed to load this section
                </Text>
                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                    Retry to refresh this saved query.
                </Text>
                <div className="mt-3">
                    <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="rounded-[16px] border border-dashed border-border-subtle px-4 py-5">
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
                <Link key={note.id} to={NOTE_ROUTE} params={{ id: note.id }} className={sectionPreviewRowClassName}>
                    <div className="min-w-0 flex-1">
                        <Text as="div" variant="body" weight="semibold" className="line-clamp-1">
                            {note.title || 'Untitled'}
                        </Text>
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                            <Text as="span" variant="label" weight="medium" tone="secondary" className="mr-0.5">
                                Updated {timeSince(Number(note.updatedAt))}
                            </Text>
                            {renderTagSummary(note)}
                        </div>
                    </div>
                    <Icon.ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5" />
                </Link>
            ))}
        </div>
    );
}
