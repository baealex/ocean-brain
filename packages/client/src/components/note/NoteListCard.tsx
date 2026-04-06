import { Link } from '@tanstack/react-router';

import { Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';

import type { Note } from '~/models/note.model';

import { timeSince } from '~/modules/time';
import { NOTE_ROUTE, TAG_NOTES_ROUTE } from '~/modules/url';

interface Props extends Note {
    onPinned?: () => void;
    onDelete?: () => void;
}

const noteMetaTextClassName = 'text-label font-medium uppercase tracking-[0.12em] text-fg-tertiary';

export default function NoteListCard({
    id,
    title,
    tags,
    pinned,
    updatedAt,
    onPinned,
    onDelete
}: Props) {
    const updatedTimeSince = timeSince(Number(updatedAt));
    const rootClassName = 'surface-base';

    return (
        <div
            key={id}
            className={`${rootClassName} relative flex h-full flex-col overflow-hidden p-4 transition-colors`}>
            <div className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2.5">
                        <div className={`inline-flex items-center gap-1.5 ${noteMetaTextClassName}`}>
                            {pinned && (
                                <Icon.Pin className="h-3 w-3 shrink-0" weight="fill" />
                            )}
                            Updated {updatedTimeSince}
                        </div>
                    </div>
                    <Dropdown
                        button={(
                            <button
                                type="button"
                                className="focus-ring-soft inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent bg-transparent text-fg-tertiary outline-none transition-colors hover:border-border-subtle hover:bg-hover-subtle hover:text-fg-default">
                                <Icon.VerticalDots className="h-5 w-5" />
                                <span className="sr-only">Note actions</span>
                            </button>
                        )}
                        items={[
                            {
                                name: pinned ? 'Unpin' : 'Pin',
                                onClick: () => onPinned?.()
                            },
                            {
                                name: 'Delete',
                                onClick: () => onDelete?.()
                            }
                        ]}
                    />
                </div>
                <div className="flex flex-1 flex-col justify-between gap-4">
                    <Link
                        className="text-body font-semibold tracking-[-0.01em] text-fg-default transition-colors hover:text-fg-default/85"
                        to={NOTE_ROUTE}
                        params={{ id }}>
                        {title || 'Untitled'}
                    </Link>
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <Link
                                    key={tag.id}
                                    to={TAG_NOTES_ROUTE}
                                    params={{ id: tag.id }}
                                    search={{ page: 1 }}>
                                    <span className="text-label inline-flex items-center rounded-full border border-border-subtle bg-transparent px-2.5 py-1 font-medium text-fg-secondary transition-colors hover:bg-hover-subtle hover:text-fg-default">
                                        {tag.name}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
