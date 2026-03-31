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

export default function NoteListCard({
    id,
    title,
    tags,
    pinned,
    createdAt,
    updatedAt,
    onPinned,
    onDelete
}: Props) {
    const createdAtText = new Date(Number(createdAt));
    const updatedTimeSince = timeSince(Number(updatedAt));
    const rootClassName = pinned ? 'surface-floating' : 'surface-base';

    return (
        <div
            key={id}
            className={`${rootClassName} group relative flex h-full flex-col overflow-hidden rounded-[30px] border border-border-subtle p-5 transition-colors`}>
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.6),transparent)]" />
            <div className="flex h-full flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-3">
                        {pinned && (
                            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-hover-subtle px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-fg-tertiary">
                                <Icon.Pin className="h-3.5 w-3.5" weight="fill" />
                                Pinned note
                            </div>
                        )}
                        <div className="space-y-1">
                            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-fg-tertiary">
                                Updated {updatedTimeSince}
                            </div>
                            <div className="text-xs text-fg-muted">
                                Opened {createdAtText.toDateString()}
                            </div>
                        </div>
                    </div>
                    <Dropdown
                        button={(
                            <span className="focus-ring-soft inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-transparent text-fg-tertiary outline-none transition-colors group-hover:border-border-subtle group-hover:bg-hover-subtle group-hover:text-fg-default">
                                <Icon.VerticalDots className="h-5 w-5" />
                            </span>
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
                <div className="flex flex-1 flex-col justify-between gap-5">
                    <Link
                        className="text-[1.05rem] font-semibold leading-7 tracking-[-0.01em] text-fg-default transition-colors hover:text-fg-default/85"
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
                                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-hover-subtle px-3 py-1 text-xs font-medium text-fg-secondary transition-colors hover:bg-hover hover:text-fg-default">
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
