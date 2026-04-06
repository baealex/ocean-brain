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
            className={`${rootClassName} group relative flex h-full flex-col overflow-hidden p-4 transition-colors`}>
            <div className="absolute right-2 top-3">
                <Dropdown
                    button={(
                        <button
                            type="button"
                            className="focus-ring-soft inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-transparent bg-transparent text-fg-tertiary outline-none transition-colors hover:border-border-subtle hover:bg-hover-subtle hover:text-fg-default">
                            <Icon.VerticalDots className="h-4 w-4" />
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
            <div className="flex h-full flex-col gap-2">
                <div className={`inline-flex items-center gap-2 ${noteMetaTextClassName}`}>
                    {pinned && (
                        <Icon.Pin className="h-3 w-3 shrink-0" weight="fill" />
                    )}
                    Updated {updatedTimeSince}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-2">
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
