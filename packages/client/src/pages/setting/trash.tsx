import dayjs from 'dayjs';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import * as Icon from '~/components/icon';
import {
    Button,
    Empty,
    FallbackRender,
    PageLayout,
    Pagination,
    Skeleton
} from '~/components/shared';
import { useToast } from '~/components/ui';
import { fetchTrashedNotes, restoreTrashedNote } from '~/apis/note.api';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE, SETTINGS_TRASH_ROUTE } from '~/modules/url';

const PAGE_SIZE = 25;
const Route = getRouteApi(SETTINGS_TRASH_ROUTE);

const formatDate = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm');

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

    return (
        <FallbackRender
            fallback={(
                <Empty
                    icon="🗑️"
                    title="Trash is empty"
                    description="Deleted notes will stay here until you restore them."
                />
            )}>
            {data.notes.length > 0 && (
                <>
                    <div className="grid gap-4">
                        {data.notes.map((note) => (
                            <article
                                key={note.id}
                                className="rounded-[12px_4px_13px_3px/4px_10px_4px_12px] border-2 border-border-secondary bg-subtle p-4 shadow-sketchy">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base font-bold">{note.title}</h2>
                                            {note.pinned && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-fg-secondary">
                                                    <Icon.Pin className="h-3.5 w-3.5" />
                                                    Pinned
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-fg-secondary">
                                            Deleted {formatDate(note.deletedAt)}
                                        </div>
                                        <div className="text-xs text-fg-tertiary">
                                            Last edited {formatDate(note.updatedAt)}
                                        </div>
                                        {note.tagNames.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {note.tagNames.map((tagName) => (
                                                    <span
                                                        key={`${note.id}-${tagName}`}
                                                        className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-fg-secondary">
                                                        {tagName}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        isLoading={restoreMutation.isPending && restoreMutation.variables === note.id}
                                        onClick={() => restoreMutation.mutate(note.id)}>
                                        Restore
                                    </Button>
                                </div>
                            </article>
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
                </>
            )}
        </FallbackRender>
    );
};

const Trash = () => {
    const { page } = Route.useSearch();

    return (
        <PageLayout title="Trash" variant="subtle" description="Restore notes that were removed from your active workspace">
            <QueryBoundary
                fallback={(
                    <div className="grid gap-4">
                        <Skeleton height="128px" />
                        <Skeleton height="128px" />
                        <Skeleton height="128px" />
                    </div>
                )}
                errorTitle="Failed to load trash"
                errorDescription="Retry loading deleted notes."
                resetKeys={[page]}>
                <TrashContent />
            </QueryBoundary>
        </PageLayout>
    );
};

export default Trash;
