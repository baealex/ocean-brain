import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import {
    Image as ImageComponent,
    PageLayout,
    Pagination,
    Skeleton,
    Empty,
    SurfaceCard
} from '~/components/shared';
import { Button, useConfirm } from '~/components/ui';
import * as Icon from '~/components/icon';

import {
    SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE,
    SETTINGS_MANAGE_IMAGE_ROUTE
} from '~/modules/url';
import { useGridLimit } from '~/hooks/useGridLimit';

import { deleteImage } from '~/apis/image.api';
import { Images } from '~/components/entities';
import { queryKeys } from '~/modules/query-key-factory';

const IMAGE_MIN_WIDTH = 240;
const IMAGE_GAP = 20;
const IMAGE_ROWS = 4;
const Route = getRouteApi(SETTINGS_MANAGE_IMAGE_ROUTE);

const ManageImage = () => {
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const navigate = Route.useNavigate();
    const { page } = Route.useSearch();
    const { containerRef, limit } = useGridLimit({
        minItemWidth: IMAGE_MIN_WIDTH,
        gap: IMAGE_GAP,
        rows: IMAGE_ROWS
    });

    const deleteImageMutation = useMutation({
        mutationFn: deleteImage,
        onSuccess: (response) => {
            if (response.type === 'error') {
                throw response;
            }
            queryClient.invalidateQueries({
                queryKey: queryKeys.images.listAll(),
                exact: false
            });
        }
    });

    const handleDelete = async (id: string) => {
        if (await confirm('Are you really sure?')) {
            deleteImageMutation.mutate(id);
        }
    };

    return (
        <PageLayout title="Images" variant="subtle" description="Manage images uploaded to your notes">
            <div ref={containerRef}>
                <QueryBoundary
                    fallback={(
                        <div className="grid-auto-cards grid gap-4">
                            <Skeleton height="200px"/>
                            <Skeleton height="200px"/>
                            <Skeleton height="200px"/>
                        </div>
                    )}
                    errorTitle="Failed to load images"
                    errorDescription="Retry loading uploaded image metadata."
                    resetKeys={[page, limit]}>
                    <Images
                        searchParams={{
                            offset: (page - 1) * limit,
                            limit
                        }}
                        render={({ images, totalCount }) => {
                            if (images.length === 0) {
                                return (
                                    <Empty
                                        title="There are no images"
                                        description="Try drag and drop an image on the note editor."
                                    />
                                );
                            }
                            return (
                                <>
                                    <div className="grid-auto-cards grid gap-4">
                                        {images.map((image) => (
                                            <SurfaceCard key={image.id} flush>
                                                <Link
                                                    to={SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE}
                                                    params={{ id: image.id }}
                                                    className="block overflow-hidden">
                                                    <ImageComponent
                                                        className="h-48 w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                                                        src={image.url}
                                                        alt={image.id}
                                                    />
                                                </Link>
                                                <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2.5">
                                                    <span className="flex items-center gap-1.5 text-sm font-medium text-fg-tertiary">
                                                        <Icon.LinkIcon className="h-3.5 w-3.5" />
                                                        {image.referenceCount}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        disabled={image.referenceCount > 0}
                                                        onClick={() => handleDelete(image.id)}>
                                                        <Icon.TrashCan className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </SurfaceCard>
                                        ))}
                                    </div>
                                    {totalCount && limit < totalCount && (
                                        <Pagination
                                            page={page}
                                            last={Math.ceil(totalCount / limit)}
                                            onChange={(page) => {
                                                navigate({
                                                    search: prev => ({
                                                        ...prev,
                                                        page
                                                    })
                                                });
                                            }}
                                        />
                                    )}
                                </>
                            );
                        }}
                    />
                </QueryBoundary>
            </div>
        </PageLayout>
    );
};

export default ManageImage;
