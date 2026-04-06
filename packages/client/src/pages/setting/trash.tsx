import dayjs from 'dayjs';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import * as Icon from '~/components/icon';
import {
    Button,
    Empty,
    PageLayout,
    Pagination,
    Skeleton,
    SurfaceCard
} from '~/components/shared';
import { Text, useToast } from '~/components/ui';
import { fetchTrashedNotes, restoreTrashedNote } from '~/apis/note.api';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE, SETTINGS_TRASH_ROUTE } from '~/modules/url';

const PAGE_SIZE = 25;
const Route = getRouteApi(SETTINGS_TRASH_ROUTE);
const TRASH_RETENTION_DAYS = 30;
const PAGE_DESCRIPTION = `Deleted notes stay here for ${TRASH_RETENTION_DAYS} days before permanent removal`;

const formatDate = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm');

const TrashSkeleton = () => (
    <PageLayout
        title="Trash"
        variant="default"
        heading={<Skeleton width={118} height={24} className="rounded-full" />}
        description={<Skeleton width={352} height={16} className="rounded-full" />}>
        <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, index) => (
                <SurfaceCard key={index} padding="compact">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton width="40%" height={18} className="rounded-full" />
                            <div className="flex flex-wrap gap-2">
                                <Skeleton width={168} height={14} className="rounded-full" />
                                <Skeleton width={176} height={14} className="rounded-full" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Skeleton width={56} height={24} className="rounded-full" />
                                <Skeleton width={72} height={24} className="rounded-full" />
                            </div>
                        </div>
                        <Skeleton width={92} height={32} className="rounded-[12px]" />
                    </div>
                </SurfaceCard>
            ))}
        </div>
    </PageLayout>
);

const TrashContent = () => {
    const { page } = Route.useSearch();
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();

    const { data } = useSuspenseQuery({
        queryKey: queryKeys.notes.trash({
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE
        }),
        queryFn: async () => {
            const response = await fetchTrashedNotes({
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE
            });

            if (response.type === 'error') {
                throw response;
            }

            return response.trashedNotes;
        }
    });

    const restoreMutation = useMutation({
        mutationFn: restoreTrashedNote,
        onSuccess: async (response) => {
            if (response.type === 'error') {
                throw response;
            }

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.all(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.tags.all(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.reminders.all(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.images.all(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: ['calendar'],
                    exact: false
                })
            ]);

            toast('The note has been restored.');
            navigate({
                to: NOTE_ROUTE,
                params: { id: response.restoreTrashedNote.id }
            });
        },
        onError: () => {
            toast('Failed to restore the note.');
        }
    });

    const heading = data.totalCount > 0 ? `Trash (${data.totalCount})` : undefined;

    if (data.notes.length === 0) {
        return (
            <PageLayout
                title="Trash"
                variant="default"
                heading={heading}
                description={PAGE_DESCRIPTION}>
                <Empty
                    title="Trash is empty"
                    description={`Delete a note and you can restore it here for ${TRASH_RETENTION_DAYS} days before permanent removal`}
                />
            </PageLayout>
        );
    }

    return (
        <PageLayout
            title="Trash"
            variant="default"
            heading={heading}
            description={PAGE_DESCRIPTION}>
            <div className="flex flex-col gap-4">
                <div className="grid gap-3">
                    {data.notes.map((note) => (
                        <SurfaceCard
                            key={note.id}
                            padding="compact">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-start gap-1.5">
                                        <Text
                                            as="h2"
                                            variant="body"
                                            weight="medium"
                                            className="min-w-0 flex-1 break-words leading-[1.25]">
                                            {note.title || 'Untitled note'}
                                        </Text>
                                        {note.pinned && (
                                            <span
                                                title="Pinned"
                                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-fg-tertiary">
                                                <Icon.Pin className="h-3.5 w-3.5" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <Text as="div" variant="meta" weight="medium" tone="secondary">
                                            Deleted {formatDate(note.deletedAt)}
                                        </Text>
                                    </div>
                                    {note.tagNames.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {note.tagNames.map((tagName) => (
                                                <Text
                                                    as="span"
                                                    key={`${note.id}-${tagName}`}
                                                    variant="label"
                                                    weight="medium"
                                                    tone="tertiary"
                                                    className="rounded-full border border-border-subtle bg-hover-subtle px-2 py-0.5">
                                                    {tagName}
                                                </Text>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="subtle"
                                    size="sm"
                                    className="self-start"
                                    isLoading={restoreMutation.isPending && restoreMutation.variables === note.id}
                                    onClick={() => restoreMutation.mutate(note.id)}>
                                    Restore
                                </Button>
                            </div>
                        </SurfaceCard>
                    ))}
                </div>
                {data.totalCount > PAGE_SIZE && (
                    <Pagination
                        page={page}
                        last={Math.ceil(data.totalCount / PAGE_SIZE)}
                        onChange={(nextPage) => {
                            navigate({
                                search: (prev) => ({
                                    ...prev,
                                    page: nextPage
                                })
                            });
                        }}
                    />
                )}
            </div>
        </PageLayout>
    );
};

const Trash = () => {
    const { page } = Route.useSearch();

    return (
        <QueryBoundary
            fallback={<TrashSkeleton />}
            errorTitle="Failed to load trash"
            errorDescription="Retry loading deleted notes"
            resetKeys={[page]}>
            <TrashContent />
        </QueryBoundary>
    );
};

export default Trash;
