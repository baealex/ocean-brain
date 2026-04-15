import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { fetchViewSectionNotes } from '~/apis/view.api';
import * as Icon from '~/components/icon';
import { Dropdown, SurfaceCard } from '~/components/shared';
import { Button, MoreButton, Text } from '~/components/ui';
import type { ViewSection } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE, VIEW_NOTES_ROUTE } from '~/modules/url';
import { buildViewNotesSearch, getViewTagMatchToken } from '~/modules/view-dashboard';

interface ViewSectionCardProps {
    section: ViewSection;
    onEdit: () => void;
    onDelete: () => void;
    dragHandle?: React.ReactNode;
}

const sectionPreviewRowClassName =
    'flex items-start justify-between gap-3 rounded-[14px] border border-border-subtle/70 px-3 py-2.5 transition-colors hover:border-border-secondary hover:bg-hover-subtle';

export default function ViewSectionCard({ section, onEdit, onDelete, dragHandle }: ViewSectionCardProps) {
    const sectionSearch = buildViewNotesSearch(section);

    const { data, isPending, isError, refetch } = useQuery({
        queryKey: queryKeys.views.sectionNotes(section.id, {
            limit: section.limit,
            offset: 0,
        }),
        async queryFn() {
            const response = await fetchViewSectionNotes(section.id, { limit: section.limit, offset: 0 });

            if (response.type === 'error') {
                throw response;
            }

            return response.viewSectionNotes;
        },
    });

    const notes = data?.notes ?? [];
    const totalCount = data?.totalCount ?? 0;
    const tagMatchToken = getViewTagMatchToken(section.mode);

    return (
        <SurfaceCard className="flex h-full flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-1">
                        {dragHandle && <div className="-mr-1 shrink-0 self-center">{dragHandle}</div>}
                        <div className="min-w-0">
                            <Text as="h2" variant="subheading" weight="semibold" tracking="tight" className="min-w-0">
                                <Link
                                    to={VIEW_NOTES_ROUTE}
                                    search={sectionSearch}
                                    className="truncate hover:text-fg-default/85"
                                >
                                    {section.title}
                                </Link>
                            </Text>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {section.tagNames.map((tagName, index) => (
                            <div key={tagName} className="flex items-center gap-1.5">
                                {index > 0 && (
                                    <span className="px-0.5 text-[10px] font-semibold tracking-[0.08em] text-fg-tertiary/85">
                                        {tagMatchToken}
                                    </span>
                                )}
                                <span className="inline-flex items-center rounded-full border border-border-subtle/80 bg-transparent px-2.5 py-1 text-xs font-medium text-fg-secondary">
                                    {tagName}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="shrink-0">
                    <Dropdown
                        button={<MoreButton label="Section actions" />}
                        items={[
                            {
                                name: 'Edit section',
                                onClick: onEdit,
                            },
                            { type: 'separator' },
                            {
                                name: 'Delete section',
                                onClick: onDelete,
                            },
                        ]}
                    />
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-2.5">
                {isPending && (
                    <>
                        <div className="h-14 animate-pulse rounded-[14px] bg-hover-subtle" />
                        <div className="h-14 animate-pulse rounded-[14px] bg-hover-subtle" />
                        <div className="h-14 animate-pulse rounded-[14px] bg-hover-subtle" />
                    </>
                )}

                {isError && (
                    <div className="rounded-[16px] border border-border-subtle bg-hover-subtle/70 p-4">
                        <Text as="p" variant="body" weight="semibold">
                            Failed to load this section
                        </Text>
                        <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                            Retry to refresh the tag-based note block.
                        </Text>
                        <div className="mt-3">
                            <Button type="button" variant="ghost" size="sm" onClick={() => refetch()}>
                                Retry
                            </Button>
                        </div>
                    </div>
                )}

                {!isPending && !isError && notes.length === 0 && (
                    <div className="rounded-[16px] border border-dashed border-border-subtle px-4 py-5">
                        <Text as="p" variant="body" weight="semibold">
                            No notes match yet
                        </Text>
                        <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                            Add more notes with these tags, or edit the section filter.
                        </Text>
                    </div>
                )}

                {!isPending &&
                    !isError &&
                    notes.map((note) => (
                        <Link
                            key={note.id}
                            to={NOTE_ROUTE}
                            params={{ id: note.id }}
                            className={sectionPreviewRowClassName}
                        >
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
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border-subtle/70 pt-4">
                <Text as="p" variant="meta" tone="tertiary">
                    {isPending ? 'Loading notes...' : `Showing ${notes.length} of ${totalCount} notes`}
                </Text>
                <Button asChild variant="subtle" size="sm">
                    <Link to={VIEW_NOTES_ROUTE} search={sectionSearch}>
                        Open list
                    </Link>
                </Button>
            </div>
        </SurfaceCard>
    );
}
