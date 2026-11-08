import { getRouteApi, Link } from '@tanstack/react-router';
import { QueryBoundary } from '~/components/app';
import Notes from '~/components/entities/Notes';
import * as Icon from '~/components/icon';
import NoteListCard from '~/components/note/NoteListCard';
import { Button, Empty, FallbackRender, NoteFilters, PageLayout, Pagination, Skeleton } from '~/components/shared';
import useNoteMutate from '~/hooks/resource/useNoteMutate';
import { useWorkspaceScope } from '~/hooks/useWorkspaceScope';
import { IS_LOCAL_ONLY_DEMO_MODE } from '~/modules/demo-mode';
import type { HomeRouteSearch } from '~/modules/route-search';
import { HOME_ROUTE, SETTINGS_IMPORT_ROUTE } from '~/modules/url';

const Route = getRouteApi(HOME_ROUTE);

export default function Home() {
    const scope = useWorkspaceScope();
    const navigate = Route.useNavigate();
    const { limit, page, sortBy, sortOrder, pinnedFirst } = Route.useSearch();

    const { onDelete, onPinned, deleteWarningDialog } = useNoteMutate();

    const updateSearchParams = (updates: Partial<HomeRouteSearch>) => {
        navigate({
            search: (prev) => ({
                ...prev,
                ...updates,
            }),
        });
    };

    return (
        <PageLayout title="" variant="none">
            <div className="flex flex-col gap-5">
                <NoteFilters
                    itemsPerPage={limit}
                    onItemsPerPageChange={(count) =>
                        updateSearchParams({
                            limit: count,
                            page: 1,
                        })
                    }
                    sortBy={sortBy}
                    onSortByChange={(sort) =>
                        updateSearchParams({
                            sortBy: sort,
                            page: 1,
                        })
                    }
                    sortOrder={sortOrder}
                    onSortOrderChange={(order) =>
                        updateSearchParams({
                            sortOrder: order,
                            page: 1,
                        })
                    }
                    pinnedFirst={pinnedFirst}
                    onPinnedFirstChange={(enabled) =>
                        updateSearchParams({
                            pinnedFirst: enabled,
                            page: 1,
                        })
                    }
                />
                <QueryBoundary
                    fallback={
                        <div className="grid-auto-cards grid gap-5">
                            <Skeleton height="112px" />
                            <Skeleton height="112px" />
                            <Skeleton height="112px" />
                        </div>
                    }
                    errorTitle="Failed to load notes"
                    errorDescription="Retry loading the current note list."
                    resetKeys={[
                        scope.kind,
                        scope.kind === 'workspace' ? scope.workspaceId : null,
                        page,
                        limit,
                        sortBy,
                        sortOrder,
                        pinnedFirst,
                    ]}
                >
                    <Notes
                        searchParams={{
                            scope,
                            offset: (page - 1) * limit,
                            limit,
                            sortBy,
                            sortOrder,
                            pinnedFirst,
                            fields: ['contentPreview'],
                        }}
                        render={({ notes, totalCount }) => (
                            <FallbackRender
                                fallback={
                                    <div>
                                        <Empty
                                            title="Ocean is calm"
                                            description="Capture anything and make waves in the ocean!"
                                        />
                                        {!IS_LOCAL_ONLY_DEMO_MODE && (
                                            <div className="mt-4 flex justify-center">
                                                <Button asChild variant="subtle">
                                                    <Link to={SETTINGS_IMPORT_ROUTE}>
                                                        <Icon.Upload className="h-4 w-4" />
                                                        Import Markdown
                                                    </Link>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                }
                            >
                                {notes.length > 0 && (
                                    <>
                                        <div className="grid-auto-cards grid gap-5">
                                            {notes.map((note) => (
                                                <NoteListCard
                                                    key={note.id}
                                                    {...note}
                                                    onPinned={() => onPinned(note.id, note.pinned)}
                                                    onDelete={() => onDelete(note.id)}
                                                />
                                            ))}
                                        </div>
                                        <FallbackRender fallback={null}>
                                            {totalCount && limit < totalCount && (
                                                <Pagination
                                                    page={page}
                                                    last={Math.ceil(totalCount / limit)}
                                                    onChange={(page) => {
                                                        updateSearchParams({ page });
                                                    }}
                                                />
                                            )}
                                        </FallbackRender>
                                    </>
                                )}
                            </FallbackRender>
                        )}
                    />
                </QueryBoundary>
            </div>
            {deleteWarningDialog}
        </PageLayout>
    );
}
