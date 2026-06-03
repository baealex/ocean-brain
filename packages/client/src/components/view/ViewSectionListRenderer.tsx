import { Link } from '@tanstack/react-router';

import * as Icon from '~/components/icon';
import { Button, Text } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE } from '~/modules/url';

interface ViewSectionListRendererProps {
    notes: Note[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
}

const sectionPreviewRowClassName =
    'flex items-start justify-between gap-3 rounded-[14px] border border-border-subtle/70 px-3 py-2.5 transition-colors hover:border-border-secondary hover:bg-hover-subtle';

export default function ViewSectionListRenderer({ notes, isPending, isError, onRetry }: ViewSectionListRendererProps) {
    if (isPending) {
        return (
            <>
                <div className="h-14 animate-pulse rounded-[14px] bg-hover-subtle" />
                <div className="h-14 animate-pulse rounded-[14px] bg-hover-subtle" />
                <div className="h-14 animate-pulse rounded-[14px] bg-hover-subtle" />
            </>
        );
    }

    if (isError) {
        return (
            <div className="rounded-[16px] border border-border-subtle bg-hover-subtle/70 p-4">
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
        <>
            {notes.map((note) => (
                <Link key={note.id} to={NOTE_ROUTE} params={{ id: note.id }} className={sectionPreviewRowClassName}>
                    <div className="min-w-0">
                        <Text as="div" variant="body" weight="semibold" className="line-clamp-1">
                            {note.title || 'Untitled'}
                        </Text>
                        <Text as="div" variant="meta" tone="tertiary" className="mt-1">
                            Updated {timeSince(Number(note.updatedAt))}
                        </Text>
                    </div>
                    <Icon.ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary" />
                </Link>
            ))}
        </>
    );
}
