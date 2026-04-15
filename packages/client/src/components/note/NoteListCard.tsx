import { Link } from '@tanstack/react-router';
import classNames from 'classnames';
import * as Icon from '~/components/icon';
import { Dropdown } from '~/components/shared';
import { MoreButton, Text } from '~/components/ui';

import type { Note } from '~/models/note.model';

import { timeSince } from '~/modules/time';
import { NOTE_ROUTE, TAG_NOTES_ROUTE } from '~/modules/url';

interface Props extends Note {
    onPinned?: () => void;
    onDelete?: () => void;
}

export default function NoteListCard({ id, title, tags, pinned, updatedAt, onPinned, onDelete }: Props) {
    const updatedTimeSince = timeSince(Number(updatedAt));

    return (
        <div
            key={id}
            className={classNames('surface-base group relative flex h-full flex-col px-4 py-3.5 transition-colors')}
        >
            {pinned && (
                <div className="absolute left-1/2 top-0 z-[1] -translate-x-1/2 -translate-y-[38%]">
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-secondary/70 bg-elevated text-fg-tertiary shadow-[0_8px_18px_-14px_rgba(23,29,38,0.32)]">
                        <Icon.Pin className="h-3.5 w-3.5" weight="fill" />
                        <span className="sr-only">Pinned note</span>
                    </div>
                </div>
            )}
            <div className="flex h-full flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        <Text as="span" variant="label" weight="medium" tone="secondary">
                            Updated {updatedTimeSince}
                        </Text>
                    </div>
                    <Dropdown
                        button={<MoreButton label="Note actions" size="sm" />}
                        items={[
                            {
                                name: pinned ? 'Unpin' : 'Pin',
                                onClick: () => onPinned?.(),
                            },
                            {
                                name: 'Delete',
                                onClick: () => onDelete?.(),
                            },
                        ]}
                    />
                </div>
                <div className="flex flex-1 flex-col justify-between gap-2.5">
                    <Text as="div" variant="body" weight="semibold" tracking="tight" className="leading-[1.45]">
                        <Link
                            className="line-clamp-2 transition-colors hover:text-fg-default/85"
                            to={NOTE_ROUTE}
                            params={{ id }}
                        >
                            {title || 'Untitled'}
                        </Link>
                    </Text>
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {tags.map((tag) => (
                                <Link key={tag.id} to={TAG_NOTES_ROUTE} params={{ id: tag.id }} search={{ page: 1 }}>
                                    <Text
                                        as="span"
                                        variant="label"
                                        weight="medium"
                                        tone="secondary"
                                        className="inline-flex items-center rounded-full border border-border-subtle bg-transparent px-2 py-0.5 transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                    >
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
