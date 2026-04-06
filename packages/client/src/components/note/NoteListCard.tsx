import { Link } from '@tanstack/react-router';

import { Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';

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
                <Text
                    as="div"
                    variant="label"
                    weight="medium"
                    tracking="wider"
                    transform="uppercase"
                    tone="tertiary"
                    className="inline-flex items-center gap-2">
                    {pinned && (
                        <Icon.Pin className="h-3 w-3 shrink-0" weight="fill" />
                    )}
                    Updated {updatedTimeSince}
                </Text>
                <div className="flex flex-1 flex-col justify-between gap-2">
                    <Text as="div" variant="body" weight="semibold" tracking="tight">
                        <Link
                            className="transition-colors hover:text-fg-default/85"
                            to={NOTE_ROUTE}
                            params={{ id }}>
                            {title || 'Untitled'}
                        </Link>
                    </Text>
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <Link
                                    key={tag.id}
                                    to={TAG_NOTES_ROUTE}
                                    params={{ id: tag.id }}
                                    search={{ page: 1 }}>
                                    <Text
                                        as="span"
                                        variant="label"
                                        weight="medium"
                                        tone="secondary"
                                        className="inline-flex items-center rounded-full border border-border-subtle bg-transparent px-2.5 py-1 transition-colors hover:bg-hover-subtle hover:text-fg-default">
                                        {tag.name}
                                    </Text>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
